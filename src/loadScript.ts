const defaultScriptUrl = 'https://cdn.unlayer.com/image-editor/embed.js';

// When reusing a host-injected tag we cannot know whether it already fired
// `error` (a dead tag never re-fires), so the wait is bounded instead of
// letting the promise hang forever.
export const REUSED_TAG_TIMEOUT_MS = 30_000;

interface TrackedLoad {
  promise: Promise<void>;
  /** Rejects a still-pending load so waiters fail fast instead of hanging. */
  abort: (reason: Error) => void;
}

// One in-flight/settled load per script URL so any number of components
// share a single <script> tag.
const loads = new Map<string, TrackedLoad>();

const resolveUrl = (scriptUrl: string): string =>
  new URL(scriptUrl, document.baseURI).href;

const findScriptTag = (scriptUrl: string): HTMLScriptElement | null => {
  // Exact match on the resolved URL — `src.includes(...)` would false-match
  // proxied or unrelated scripts whose URL merely contains ours.
  const resolved = resolveUrl(scriptUrl);
  const scripts = Array.from(document.querySelectorAll('script'));
  return scripts.find((script) => script.src === resolved) ?? null;
};

/**
 * Load the image editor embed script. Resolves once window.ImageEditor is
 * available; rejects if the script fails to load (or, for a reused
 * host-injected tag, if it doesn't become ready within a bounded wait).
 */
export const loadScript = (
  scriptUrl: string = defaultScriptUrl,
  reusedTagTimeoutMs: number = REUSED_TAG_TIMEOUT_MS
): Promise<void> => {
  // The embed loader assigns window.ImageEditor synchronously while
  // embed.js evaluates, so its presence means the script already ran
  // (whether we injected it or the host page did).
  if (window.ImageEditor) {
    // Prefetch the versioned bundle, exactly as the load listener below
    // does. Without this a page that injected embed.js itself pays a full
    // extra round trip on the first createEditor. The embed loader caches
    // its own promise, so a duplicate call is a no-op.
    window.ImageEditor.load().catch(() => {});
    return Promise.resolve();
  }

  const cached = loads.get(scriptUrl);
  if (cached) {
    return cached.promise;
  }

  let abort!: (reason: Error) => void;
  const promise = new Promise<void>((resolve, reject) => {
    // Reuse a host-injected tag that hasn't loaded yet instead of
    // injecting a duplicate.
    const existing = findScriptTag(scriptUrl);
    const tag = existing ?? document.createElement('script');
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const failWith = (error: Error) => {
      // A tag that fired `error` never fires again — evict the cache and
      // remove the dead tag so a retry injects a fresh one.
      if (timeout !== undefined) clearTimeout(timeout);
      loads.delete(scriptUrl);
      tag.remove();
      reject(error);
    };
    abort = failWith;

    tag.addEventListener(
      'load',
      () => {
        if (timeout !== undefined) clearTimeout(timeout);
        // Prefetch the versioned bundle so the first createEditor doesn't
        // pay a second network hop. A prefetch failure is swallowed here —
        // the same failure surfaces through createEditor's rejection.
        window.ImageEditor?.load().catch(() => {});
        resolve();
      },
      { once: true }
    );

    tag.addEventListener(
      'error',
      () => {
        failWith(
          new Error(
            `Failed to load the image editor embed script: ${scriptUrl}`
          )
        );
      },
      { once: true }
    );

    if (existing) {
      // The tag may have errored before we attached listeners (a loaded
      // embed would have been caught by the window.ImageEditor check
      // above) — bound the wait so the promise can't hang forever.
      timeout = setTimeout(() => {
        failWith(
          new Error(
            `Timed out waiting for an existing embed script tag: ${scriptUrl}`
          )
        );
      }, reusedTagTimeoutMs);
    } else {
      tag.src = scriptUrl;
      document.head.appendChild(tag);
    }
  });

  loads.set(scriptUrl, { promise, abort });
  return promise;
};

/**
 * Hard-reset the embed loader. The CDN loader caches its versioned-bundle
 * promise forever — including rejections — so after a bundle-load failure
 * the only way to retry is to reload embed.js with fresh module state.
 * Rejects any still-pending load for the URL (waiters fail fast through
 * their normal error paths instead of hanging on a removed tag), removes
 * the embed script tag, deletes window.ImageEditor, and evicts the cached
 * load; the next loadScript call starts from scratch.
 */
export const resetLoader = (scriptUrl: string = defaultScriptUrl): void => {
  const tracked = loads.get(scriptUrl);
  loads.delete(scriptUrl);
  tracked?.abort(new Error(`The image editor loader was reset: ${scriptUrl}`));
  findScriptTag(scriptUrl)?.remove();
  delete window.ImageEditor;
};
