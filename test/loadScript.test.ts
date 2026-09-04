import type { ImageEditorEmbed } from '../src/types';

// The module holds a per-URL promise cache, so every test imports a fresh
// copy via vi.resetModules() + dynamic import.
let loadScript: typeof import('../src/loadScript').loadScript;
let resetLoader: typeof import('../src/loadScript').resetLoader;

const scriptTags = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script'));

const mockEmbed = (): ImageEditorEmbed =>
  ({
    load: vi.fn(async () => {}),
    createEditor: vi.fn(),
    baseUrl: '',
  }) as unknown as ImageEditorEmbed;

const fire = (tag: HTMLScriptElement, type: 'load' | 'error') => {
  tag.dispatchEvent(new Event(type));
};

beforeEach(async () => {
  vi.resetModules();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete window.ImageEditor;
  ({ loadScript, resetLoader } = await import('../src/loadScript'));
});

it('resolves immediately without injecting when window.ImageEditor exists', async () => {
  window.ImageEditor = mockEmbed();

  await loadScript();

  expect(scriptTags()).toHaveLength(0);
});

it('injects the embed script and prefetches the bundle on load', async () => {
  const promise = loadScript();

  const tags = scriptTags();
  expect(tags).toHaveLength(1);
  expect(tags[0].src).toContain(
    'https://cdn.unlayer.com/image-editor/embed.js'
  );

  // embed.js assigns the global synchronously as it evaluates.
  window.ImageEditor = mockEmbed();
  fire(tags[0], 'load');
  await promise;

  expect(window.ImageEditor.load).toHaveBeenCalledTimes(1);
});

it('swallows prefetch failures — they surface later through createEditor', async () => {
  const promise = loadScript();

  const embed = mockEmbed();
  (embed.load as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error('bundle 404')
  );
  window.ImageEditor = embed;
  fire(scriptTags()[0], 'load');

  // Resolves despite the failed prefetch, with no unhandled rejection.
  await promise;
  expect(embed.load).toHaveBeenCalledTimes(1);
});

it('dedupes concurrent calls onto a single tag and promise', async () => {
  const first = loadScript();
  const second = loadScript();

  expect(second).toBe(first);
  expect(scriptTags()).toHaveLength(1);

  window.ImageEditor = mockEmbed();
  fire(scriptTags()[0], 'load');
  await Promise.all([first, second]);
});

it('reuses a host-injected tag instead of injecting a duplicate', async () => {
  const hostTag = document.createElement('script');
  hostTag.src = 'https://cdn.unlayer.com/image-editor/embed.js';
  document.head.appendChild(hostTag);

  const promise = loadScript();

  expect(scriptTags()).toHaveLength(1);

  window.ImageEditor = mockEmbed();
  fire(hostTag, 'load');
  await promise;
});

it('does not reuse a tag whose URL merely contains the script URL', async () => {
  // e.g. a proxied copy: reusing it would attach listeners to a script
  // that is not our embed and may never fire.
  const proxied = document.createElement('script');
  proxied.src =
    'https://proxy.example.com/fetch?url=https://cdn.unlayer.com/image-editor/embed.js';
  document.head.appendChild(proxied);

  loadScript();

  const tags = scriptTags();
  expect(tags).toHaveLength(2);
  expect(tags[1].src).toBe('https://cdn.unlayer.com/image-editor/embed.js');
});

it('times out on a reused tag that never fires (already-errored host tag)', async () => {
  vi.useFakeTimers();
  try {
    // Simulates a host-injected tag that fired `error` before we attached
    // listeners — it will never fire again.
    const deadTag = document.createElement('script');
    deadTag.src = 'https://cdn.unlayer.com/image-editor/embed.js';
    document.head.appendChild(deadTag);

    const promise = loadScript();
    const rejection = expect(promise).rejects.toThrow(/Timed out/);
    vi.advanceTimersByTime(30_000);
    await rejection;

    // The dead tag was removed and the cache evicted: a retry injects fresh.
    expect(scriptTags()).toHaveLength(0);
    loadScript();
    expect(scriptTags()).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
});

it('resetLoader rejects a still-pending load so waiters fail fast', async () => {
  const pending = loadScript();
  expect(scriptTags()).toHaveLength(1);

  resetLoader();

  await expect(pending).rejects.toThrow(/loader was reset/);
  expect(scriptTags()).toHaveLength(0);
});

it('rejects on script error, removes the dead tag, and retries fresh', async () => {
  const promise = loadScript();
  const failed = scriptTags()[0];

  fire(failed, 'error');
  await expect(promise).rejects.toThrow(/Failed to load/);

  // The dead tag is gone, so a retry injects a new one that can succeed.
  expect(scriptTags()).toHaveLength(0);

  const retry = loadScript();
  const fresh = scriptTags();
  expect(fresh).toHaveLength(1);
  expect(fresh[0]).not.toBe(failed);

  window.ImageEditor = mockEmbed();
  fire(fresh[0], 'load');
  await retry;
});

it('tracks distinct script URLs independently', async () => {
  const first = loadScript('https://a.example.com/embed.js');
  const second = loadScript('https://b.example.com/embed.js');

  expect(first).not.toBe(second);
  expect(scriptTags()).toHaveLength(2);

  window.ImageEditor = mockEmbed();
  scriptTags().forEach((tag) => fire(tag, 'load'));
  await Promise.all([first, second]);
});

it('resetLoader removes the global, the tag, and the cached promise', async () => {
  const promise = loadScript();
  window.ImageEditor = mockEmbed();
  fire(scriptTags()[0], 'load');
  await promise;

  resetLoader();

  expect(window.ImageEditor).toBeUndefined();
  expect(scriptTags()).toHaveLength(0);

  // Fresh start: a new call injects a new tag.
  const retry = loadScript();
  expect(scriptTags()).toHaveLength(1);

  window.ImageEditor = mockEmbed();
  fire(scriptTags()[0], 'load');
  await retry;
});

it('resetLoader leaves a host-injected tag and its global alone', async () => {
  // The host page loaded embed.js itself and other consumers may be using
  // the global — tearing it down here would break them.
  const hostTag = document.createElement('script');
  hostTag.src = 'https://cdn.unlayer.com/image-editor/embed.js';
  document.head.appendChild(hostTag);

  const promise = loadScript();
  const embed = mockEmbed();
  window.ImageEditor = embed;
  fire(hostTag, 'load');
  await promise;

  resetLoader();

  expect(window.ImageEditor).toBe(embed);
  expect(scriptTags()).toEqual([hostTag]);
});

it('resetLoader rejects waiters on a reused host tag without removing it', async () => {
  const hostTag = document.createElement('script');
  hostTag.src = 'https://cdn.unlayer.com/image-editor/embed.js';
  document.head.appendChild(hostTag);

  const pending = loadScript();
  const rejection = expect(pending).rejects.toThrow(/loader was reset/);

  resetLoader();
  await rejection;

  // Our cache is cleared, but the host's still-loading tag is untouched.
  expect(scriptTags()).toEqual([hostTag]);
});

it('resetLoader is a no-op when nothing was ever loaded', () => {
  expect(() => resetLoader()).not.toThrow();
  expect(scriptTags()).toHaveLength(0);
});
