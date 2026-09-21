const defaultScriptUrl = 'https://cdn.unlayer.com/image-editor/embed.js';

// When reusing a host-injected tag we cannot know whether it already fired
// `error` (a dead tag never re-fires), so the wait is bounded instead of
// letting the promise hang forever.
const REUSED_TAG_TIMEOUT_MS = 30_000;

interface TrackedLoad {
  promise: Promise<void>;
  /** Rejects a still-pending load so waiters fail fast instead of hanging. */
  abort: (reason: Error) => void;
}

// One in-flight/settled load per script URL so any number of components
// share a single <script> tag.
const loads = new Map<string, TrackedLoad>();

// The tags this module injected. Anything else matching the script URL was
// put there by the host page, which may have other consumers of the embed:
// a reset must not remove it, or delete the global it installed, from under
// them. A tag that has provably failed is still removed either way — see
// failWith.
const ownedTags = new WeakSet<HTMLScriptElement>();

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
  scriptUrl: string = defaultScriptUrl
): Promise<void> => {
  // The embed loader assigns window.ImageEditor synchronously while
  // embed.js evaluates, so its presence means the script already ran
  // (whether we injected it or the host page did).
  if (window.ImageEditor) {
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

    const failWith = (error: Error, removeTag: boolean) => {
      // A tag that fired `error` (or timed out) never fires again — evict
      // the cache and remove the dead tag so a retry injects a fresh one,
      // even when the host injected it: a failed tag is no use to anyone.
      // A reset is different — the tag there may be perfectly alive — so it
      // removes only what we own.
      if (timeout !== undefined) clearTimeout(timeout);
      loads.delete(scriptUrl);
      if (removeTag) tag.remove();
      reject(error);
    };
    abort = (error: Error) => failWith(error, ownedTags.has(tag));

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
          ),
          true
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
          ),
          true
        );
      }, REUSED_TAG_TIMEOUT_MS);
    } else {
      tag.src = scriptUrl;
      ownedTags.add(tag);
      document.head.appendChild(tag);
    }
  });

  loads.set(scriptUrl, { promise, abort });
  return promise;
};

/**
 * Reset this module's loader state for a script URL. Rejects any
 * still-pending load (waiters fail fast through their normal error paths
 * instead of hanging on a removed tag) and evicts the cached load, so the
 * next loadScript call starts from scratch.
 *
 * The script tag and window.ImageEditor are only torn down when we injected
 * the tag ourselves. On a page that loaded embed.js itself the embed may be
 * in active use by other consumers, and removing a working global out from
 * under them is not ours to do.
 *
 * Recovery does not depend on any of this: embed.js nulls its own cached
 * promise when a bundle load fails, so a later createEditor retries whether
 * or not the tag was ours. This only clears the state we own.
 */
export const resetLoader = (scriptUrl: string = defaultScriptUrl): void => {
  // Captured before abort(), which may remove the tag itself.
  const tag = findScriptTag(scriptUrl);
  const ownedTag = tag && ownedTags.has(tag) ? tag : null;

  const tracked = loads.get(scriptUrl);
  loads.delete(scriptUrl);
  tracked?.abort(new Error(`The image editor loader was reset: ${scriptUrl}`));

  if (ownedTag) {
    ownedTag.remove();
    delete window.ImageEditor;
  }
};
