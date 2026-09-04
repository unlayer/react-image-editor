import React from 'react';
import { act, render } from '@testing-library/react';

import ImageEditor, {
  ImageEditorInstance,
  ImageEditorOptions,
  ImageEditorRef,
  ImageEditorSaveResult,
  MountOptions,
} from '../src';
import { loadScript, resetLoader } from '../src/loadScript';
import { stableKey } from '../src/stableKey';

// Resolve the embed script immediately instead of hitting the network.
vi.mock('../src/loadScript', () => ({
  loadScript: vi.fn(() => Promise.resolve()),
  resetLoader: vi.fn(),
}));

// Spy only — the real implementation still runs, so behaviour is unchanged.
// Lets a test assert that the option keys are actually memoised.
vi.mock('../src/stableKey', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/stableKey')>();
  return { stableKey: vi.fn(actual.stableKey) };
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

const defer = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

// Flush the component's serialized promise chain.
const flush = () => act(async () => {});

interface MockInstance {
  destroy: ReturnType<typeof vi.fn>;
  getImage: ReturnType<typeof vi.fn>;
  hasChanges: ReturnType<typeof vi.fn>;
  updateOptions: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
}

// Distinct instances let a test tell "the replaced editor was skipped"
// apart from "no editor was touched at all".
const makeInstance = (): MockInstance => ({
  destroy: vi.fn(),
  getImage: vi.fn(() => null),
  hasChanges: vi.fn(() => false),
  updateOptions: vi.fn(),
  reset: vi.fn(async () => {}),
});

let mockInstance: MockInstance;
let createEditor: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.mocked(loadScript).mockClear();
  vi.mocked(loadScript).mockImplementation(() => Promise.resolve());
  vi.mocked(resetLoader).mockClear();

  vi.mocked(stableKey).mockClear();
  mockInstance = makeInstance();
  createEditor = vi.fn(async () => mockInstance);
  window.ImageEditor = {
    createEditor,
    load: vi.fn(async () => {}),
    baseUrl: '',
  } as unknown as Window['ImageEditor'];
  delete window.__ImageEditorImpl__;
});

const mountOptionsOf = (call = 0) =>
  createEditor.mock.calls[call][0] as MountOptions;

it('renders the editor container', async () => {
  render(<ImageEditor editorId="test-editor" image="img-a" />);

  expect(document.querySelector('#test-editor')).toBeTruthy();
  await flush();
});

it('creates the editor with the container element, image, and options', async () => {
  render(
    <ImageEditor
      editorId="test-editor"
      image="img-a"
      options={{ projectId: 123, theme: 'dark' }}
    />
  );
  await flush();

  expect(createEditor).toHaveBeenCalledTimes(1);
  const options = mountOptionsOf();
  expect(options.container).toBe(document.querySelector('#test-editor'));
  expect(options.image).toBe('img-a');
  expect(options.projectId).toBe(123);
  expect(options.theme).toBe('dark');
});

it('passes every documented option through to createEditor unchanged', async () => {
  // One entry for each key documented in the README's options table,
  // including a tools enable/disable/icon config. The wrapper's contract
  // is verbatim pass-through; the show/hide behavior itself belongs to
  // the underlying editor.
  const options = {
    projectId: 1234,
    user: { id: 'u1', name: 'Adeel', email: 'adeel@example.com' },
    features: {
      imageEditor: {
        enabled: true,
        dock: 'left',
        tools: {
          corners: true,
          draw: false,
          stickers: { enabled: false },
          crop: { icon: 'fa-crop-simple' },
          text: { icon: 'https://example.com/icons/text.svg' },
        },
      },
      ai: { enabled: true, assistant: true },
    },
    env: { API_V2_BASE_URL: 'https://api.example.com' },
    theme: 'dark',
    locale: 'es',
    translations: { es: { 'editor.save': 'Guardar' } },
    offline: false,
    licenseUrl: 'https://example.com/license.json',
    defaultPrompt: 'Remove the background',
    autoSubmitPrompt: false,
    aiAssistantOpenState: 'closed',
  } satisfies ImageEditorOptions;

  render(<ImageEditor image="img-a" options={options} />);
  await flush();

  const received = mountOptionsOf();
  const { container, image, onSave, onCancel, onLoadError, ...passedThrough } =
    received;
  expect(passedThrough).toEqual(options);
  // Nested configs arrive by reference, not a lossy copy.
  expect(received.features).toBe(options.features);
});

it('remounts when the tools config changes', async () => {
  const toolsOf = (draw: boolean) => ({
    imageEditor: { tools: { draw } },
  });

  const { rerender } = render(
    <ImageEditor image="img-a" options={{ features: toolsOf(true) }} />
  );
  await flush();

  rerender(
    <ImageEditor image="img-a" options={{ features: toolsOf(false) }} />
  );
  await flush();

  // README documents features as remount-tier: destroy + recreate.
  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  expect(createEditor).toHaveBeenCalledTimes(2);
  expect(mountOptionsOf(1).features?.imageEditor).toEqual({
    tools: { draw: false },
  });
});

it('does not remount when the tools config is deep-equal but not reference-equal', async () => {
  const { rerender } = render(
    <ImageEditor
      image="img-a"
      options={{ features: { imageEditor: { tools: { draw: false } } } }}
    />
  );
  await flush();

  // A fresh-but-identical object literal (the common inline-props case).
  rerender(
    <ImageEditor
      image="img-a"
      options={{ features: { imageEditor: { tools: { draw: false } } } }}
    />
  );
  await flush();

  expect(mockInstance.destroy).not.toHaveBeenCalled();
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('does not remount when the same options are written in a different key order', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" options={{ projectId: 1234, offline: false }} />
  );
  await flush();

  // Same configuration, keys in the other order — the common case when
  // options are assembled conditionally rather than as one fixed literal.
  rerender(
    <ImageEditor image="img-a" options={{ offline: false, projectId: 1234 }} />
  );
  await flush();

  expect(mockInstance.destroy).not.toHaveBeenCalled();
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('does not re-serialize options when the object identity is stable', async () => {
  const options: ImageEditorOptions = { projectId: 1234, offline: false };
  const { rerender } = render(<ImageEditor image="img-a" options={options} />);
  await flush();

  const afterMount = vi.mocked(stableKey).mock.calls.length;
  expect(afterMount).toBeGreaterThan(0);

  // Same object, three more renders: the memos should absorb all of them.
  rerender(<ImageEditor image="img-a" options={options} />);
  rerender(<ImageEditor image="img-b" options={options} />);
  rerender(<ImageEditor image="img-c" options={options} />);
  await flush();

  expect(vi.mocked(stableKey).mock.calls.length).toBe(afterMount);
});

it('re-serializes when a fresh options object arrives', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" options={{ projectId: 1234 }} />
  );
  await flush();
  const afterMount = vi.mocked(stableKey).mock.calls.length;

  rerender(<ImageEditor image="img-a" options={{ projectId: 1234 }} />);

  expect(vi.mocked(stableKey).mock.calls.length).toBeGreaterThan(afterMount);
  // ...and still resolves to the same key, so no remount.
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('does not serialize a fresh empty default on every render', async () => {
  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();
  const afterMount = vi.mocked(stableKey).mock.calls.length;

  rerender(<ImageEditor image="img-b" />);
  rerender(<ImageEditor image="img-c" />);
  await flush();

  // Omitting `options` used to hand the memo a new {} each render.
  expect(vi.mocked(stableKey).mock.calls.length).toBe(afterMount);
});

it('exposes the editor instance through the ref and calls onLoad', async () => {
  const ref = React.createRef<ImageEditorRef>();
  const onLoad = vi.fn();

  render(<ImageEditor ref={ref} image="img-a" onLoad={onLoad} />);
  await flush();

  expect(ref.current?.editor).toBe(mockInstance);
  expect(onLoad).toHaveBeenCalledWith(mockInstance);
});

it('destroys the editor on unmount', async () => {
  const { unmount } = render(<ImageEditor image="img-a" />);
  await flush();

  expect(mockInstance.destroy).not.toHaveBeenCalled();
  unmount();
  await flush();
  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
});

it('skips createEditor when unmounted while the embed script loads', async () => {
  const deferred = defer<void>();
  vi.mocked(loadScript).mockImplementationOnce(() => deferred.promise);

  const { unmount } = render(<ImageEditor image="img-a" />);
  await flush();
  unmount();
  deferred.resolve();
  await flush();

  expect(createEditor).not.toHaveBeenCalled();
});

it('destroys an editor that resolves after unmount', async () => {
  const deferred = defer<ImageEditorInstance>();
  createEditor.mockImplementationOnce(() => deferred.promise);

  const { unmount } = render(<ImageEditor image="img-a" />);
  await flush();
  expect(createEditor).toHaveBeenCalledTimes(1);

  unmount();
  deferred.resolve(mockInstance as unknown as ImageEditorInstance);
  await flush();

  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
});

it('mounts exactly one live editor under StrictMode', async () => {
  render(
    <React.StrictMode>
      <ImageEditor image="img-a" />
    </React.StrictMode>
  );
  await flush();

  const created = createEditor.mock.calls.length;
  const destroyed = mockInstance.destroy.mock.calls.length;
  expect(created - destroyed).toBe(1);
});

it('applies an image change via reset without remounting', async () => {
  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  await flush();

  expect(mockInstance.reset).toHaveBeenCalledWith('img-b');
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('applies a theme change via updateOptions without remounting', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" options={{ theme: 'light' }} />
  );
  await flush();
  expect(mockInstance.updateOptions).not.toHaveBeenCalled();

  rerender(<ImageEditor image="img-a" options={{ theme: 'dark' }} />);
  await flush();

  expect(mockInstance.updateOptions).toHaveBeenCalledWith(
    expect.objectContaining({ theme: 'dark' })
  );
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('reports an updateOptions throw via onError without poisoning the chain', async () => {
  const onError = vi.fn();
  mockInstance.updateOptions.mockImplementation(() => {
    throw new Error('theme apply failed');
  });

  const { rerender } = render(
    <ImageEditor image="img-a" onError={onError} options={{ theme: 'light' }} />
  );
  await flush();

  rerender(
    <ImageEditor image="img-a" onError={onError} options={{ theme: 'dark' }} />
  );
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect((onError.mock.calls[0][0] as Error).message).toBe(
    'theme apply failed'
  );
  expect(createEditor).toHaveBeenCalledTimes(1);

  mockInstance.updateOptions.mockReset();
  rerender(
    <ImageEditor image="img-b" onError={onError} options={{ theme: 'dark' }} />
  );
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-b');
});

it('remounts the editor when a non-updatable option changes', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" options={{ projectId: 1 }} />
  );
  await flush();

  rerender(<ImageEditor image="img-a" options={{ projectId: 2 }} />);
  await flush();

  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  expect(createEditor).toHaveBeenCalledTimes(2);
  expect(mountOptionsOf(1).projectId).toBe(2);
});

it('always invokes the latest callbacks', async () => {
  const firstOnSave = vi.fn();
  const secondOnSave = vi.fn();

  const { rerender } = render(
    <ImageEditor image="img-a" onSave={firstOnSave} />
  );
  await flush();

  rerender(<ImageEditor image="img-a" onSave={secondOnSave} />);
  await flush();

  const payload: ImageEditorSaveResult = {
    dataUrl: 'data:image/png;base64,x',
    blob: new Blob(),
  };
  mountOptionsOf().onSave?.(payload);

  expect(secondOnSave).toHaveBeenCalledWith(payload);
  expect(firstOnSave).not.toHaveBeenCalled();
});

it('applies minHeight and style to the container', async () => {
  render(
    <ImageEditor
      editorId="styled-editor"
      image="img-a"
      minHeight={640}
      style={{ background: 'rgb(1, 2, 3)' }}
    />
  );
  await flush();

  const container = document.querySelector<HTMLElement>('#styled-editor')!;
  expect(container.style.background).toBe('rgb(1, 2, 3)');
  expect((container.parentElement as HTMLElement).style.minHeight).toBe(
    '640px'
  );
});

it('passes onCancel and onLoadError through to the editor', async () => {
  const onCancel = vi.fn();
  const onLoadError = vi.fn();

  render(
    <ImageEditor image="img-a" onCancel={onCancel} onLoadError={onLoadError} />
  );
  await flush();

  mountOptionsOf().onCancel?.();
  mountOptionsOf().onLoadError?.();

  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(onLoadError).toHaveBeenCalledTimes(1);
});

it('wraps non-Error rejections into Error for onError', async () => {
  vi.mocked(loadScript).mockRejectedValueOnce('cdn exploded');
  const onError = vi.fn();

  render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  const error = onError.mock.calls[0][0] as Error;
  expect(error).toBeInstanceOf(Error);
  expect(error.message).toBe('cdn exploded');
});

it('forwards a custom scriptUrl to loadScript', async () => {
  render(
    <ImageEditor image="img-a" scriptUrl="https://example.com/embed.js" />
  );
  await flush();

  expect(loadScript).toHaveBeenCalledWith('https://example.com/embed.js');
});

it('reports a loadScript failure via onError and recovers on remount', async () => {
  vi.mocked(loadScript).mockRejectedValueOnce(new Error('cdn down'));
  const onError = vi.fn();

  const { rerender } = render(
    <ImageEditor image="img-a" onError={onError} options={{ projectId: 1 }} />
  );
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect(createEditor).not.toHaveBeenCalled();

  // The chain is not poisoned: a remount-tier change mounts normally.
  rerender(
    <ImageEditor image="img-a" onError={onError} options={{ projectId: 2 }} />
  );
  await flush();

  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('reports a missing window.ImageEditor global via onError', async () => {
  delete window.ImageEditor;
  const onError = vi.fn();

  render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  expect((onError.mock.calls[0][0] as Error).message).toMatch(/unavailable/);
});

it('reports a createEditor rejection via onError and unmounts cleanly', async () => {
  createEditor.mockRejectedValueOnce(new Error('mount failed'));
  const onError = vi.fn();

  const { unmount } = render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  unmount();
  await flush();
  expect(mockInstance.destroy).not.toHaveBeenCalled();
});

it('ends on the latest image when it changes while createEditor is in flight', async () => {
  const deferred = defer<ImageEditorInstance>();
  createEditor.mockImplementationOnce(() => deferred.promise);

  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  deferred.resolve(mockInstance as unknown as ImageEditorInstance);
  await flush();

  expect(mockInstance.reset).toHaveBeenCalledWith('img-b');
});

it('falls back to console.error when onError is not provided', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(loadScript).mockRejectedValueOnce(new Error('cdn down'));

  render(<ImageEditor image="img-a" />);
  await flush();

  expect(consoleError).toHaveBeenCalled();
  consoleError.mockRestore();
});

it('skips a reset that collapses back to the applied image', async () => {
  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  rerender(<ImageEditor image="img-a" />);
  await flush();

  expect(mockInstance.reset).not.toHaveBeenCalled();
});

it('skips a queued reset and updateOptions when a remount replaces the instance', async () => {
  const oldInstance = makeInstance();
  const newInstance = makeInstance();
  createEditor
    .mockImplementationOnce(async () => oldInstance)
    .mockImplementationOnce(async () => newInstance);

  const { rerender } = render(
    <ImageEditor image="img-a" options={{ projectId: 1, theme: 'light' }} />
  );
  await flush();

  // image, theme and a remount-tier option all change in one commit: the
  // effects still see the outgoing editor, so both guards must fire.
  rerender(
    <ImageEditor image="img-b" options={{ projectId: 2, theme: 'dark' }} />
  );
  await flush();

  expect(oldInstance.reset).not.toHaveBeenCalled();
  expect(oldInstance.updateOptions).not.toHaveBeenCalled();
  expect(oldInstance.destroy).toHaveBeenCalledTimes(1);

  // The replacement mount carries the new image and theme itself, so it has
  // nothing left to re-apply.
  expect(createEditor).toHaveBeenCalledTimes(2);
  expect(mountOptionsOf(1).image).toBe('img-b');
  expect(mountOptionsOf(1).theme).toBe('dark');
  expect(newInstance.reset).not.toHaveBeenCalled();
  expect(newInstance.updateOptions).not.toHaveBeenCalled();
});

it('serializes overlapping image changes and collapses to the final value', async () => {
  const resets: Deferred<void>[] = [];
  mockInstance.reset.mockImplementation(() => {
    const deferred = defer<void>();
    resets.push(deferred);
    return deferred.promise;
  });

  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  await flush();
  expect(mockInstance.reset).toHaveBeenCalledTimes(1);
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-b');

  // A second change while the first reset is pending must wait.
  rerender(<ImageEditor image="img-c" />);
  await flush();
  expect(mockInstance.reset).toHaveBeenCalledTimes(1);

  resets[0].resolve();
  await flush();
  expect(mockInstance.reset).toHaveBeenCalledTimes(2);
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-c');

  resets[1].resolve();
  await flush();
});

it('resets again when the image reverts to a previously applied value', async () => {
  const { rerender } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-b');

  rerender(<ImageEditor image="img-a" />);
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-a');
  expect(mockInstance.reset).toHaveBeenCalledTimes(2);
});

it('reports a reset rejection via onError without poisoning the chain', async () => {
  const onError = vi.fn();
  const { rerender } = render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  mockInstance.reset.mockRejectedValueOnce(new Error('reload failed'));
  rerender(<ImageEditor image="img-b" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));

  // The chain still works: a later image change resets normally.
  rerender(<ImageEditor image="img-c" onError={onError} />);
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-c');
});

it('contains a throwing onError without poisoning the chain', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = vi.fn(() => {
    throw new Error('boom');
  });
  const { rerender } = render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  // fail() runs as the terminal .catch of the chain; a throwing onError
  // must be swallowed rather than rejecting chainRef.
  mockInstance.reset.mockRejectedValueOnce(new Error('reload failed'));
  rerender(<ImageEditor image="img-b" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledWith(expect.any(Error));
  // The callback's own throw is reported, not propagated.
  expect(consoleError).toHaveBeenCalledWith(
    '[react-image-editor] onError callback threw',
    expect.any(Error)
  );

  // The chain survived: a later image change still resets normally.
  rerender(<ImageEditor image="img-c" onError={onError} />);
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-c');

  consoleError.mockRestore();
});

it('contains a throwing onLoad without reporting a wrapper failure', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  const onError = vi.fn();
  const onLoad = vi.fn(() => {
    throw new Error('boom');
  });

  const { rerender } = render(
    <ImageEditor image="img-a" onLoad={onLoad} onError={onError} />
  );
  await flush();

  // The callback's own throw is reported, not propagated.
  expect(consoleError).toHaveBeenCalledWith(
    '[react-image-editor] onLoad callback threw',
    expect.any(Error)
  );
  // The editor mounted, so the consumer must not see a wrapper failure and
  // the shared loader must survive.
  expect(onError).not.toHaveBeenCalled();
  expect(resetLoader).not.toHaveBeenCalled();

  // The instance is still live: a later image change resets normally.
  rerender(<ImageEditor image="img-b" onLoad={onLoad} onError={onError} />);
  await flush();
  expect(mockInstance.reset).toHaveBeenLastCalledWith('img-b');

  consoleError.mockRestore();
});

it('waits for a pending reset before destroying on unmount', async () => {
  const resetDeferred = defer<void>();
  mockInstance.reset.mockImplementationOnce(() => resetDeferred.promise);

  const { rerender, unmount } = render(<ImageEditor image="img-a" />);
  await flush();

  rerender(<ImageEditor image="img-b" />);
  await flush();
  expect(mockInstance.reset).toHaveBeenCalledTimes(1);

  unmount();
  await flush();
  // Destroy is queued behind the pending reset.
  expect(mockInstance.destroy).not.toHaveBeenCalled();

  resetDeferred.resolve();
  await flush();
  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
});

it('remounts when scriptUrl changes', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" scriptUrl="https://a.example.com/embed.js" />
  );
  await flush();

  rerender(
    <ImageEditor image="img-a" scriptUrl="https://b.example.com/embed.js" />
  );
  await flush();

  expect(mockInstance.destroy).toHaveBeenCalledTimes(1);
  expect(createEditor).toHaveBeenCalledTimes(2);
  expect(loadScript).toHaveBeenLastCalledWith('https://b.example.com/embed.js');
});

it('reverts theme to default when it is removed from options', async () => {
  const { rerender } = render(
    <ImageEditor image="img-a" options={{ theme: 'dark' }} />
  );
  await flush();

  rerender(<ImageEditor image="img-a" options={{}} />);
  await flush();

  expect(mockInstance.updateOptions).toHaveBeenCalledTimes(1);
  const applied = mockInstance.updateOptions.mock.calls[0][0];
  expect('theme' in applied).toBe(true);
  expect(applied.theme).toBeUndefined();
  expect(createEditor).toHaveBeenCalledTimes(1);
});

it('hard-resets the loader only when the bundle never evaluated', async () => {
  // Bundle-load failure: impl global absent -> reset the loader.
  createEditor.mockRejectedValueOnce(new Error('bundle 404'));
  const onError = vi.fn();

  const { unmount } = render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledTimes(1);
  expect(resetLoader).toHaveBeenCalledTimes(1);
  unmount();
  await flush();

  // Mount error: impl global present -> keep the loader.
  vi.mocked(resetLoader).mockClear();
  window.__ImageEditorImpl__ = {};
  createEditor.mockRejectedValueOnce(new Error('container occupied'));

  render(<ImageEditor image="img-a" onError={onError} />);
  await flush();

  expect(onError).toHaveBeenCalledTimes(2);
  expect(resetLoader).not.toHaveBeenCalled();
});
