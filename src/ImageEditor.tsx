import React, {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { loadScript, resetLoader } from './loadScript';
import { ImageEditorInstance, ImageEditorProps, ImageEditorRef } from './types';

function ImageEditorInner(
  props: ImageEditorProps,
  ref: React.Ref<ImageEditorRef>
) {
  const {
    image,
    options = {},
    scriptUrl,
    minHeight = 500,
    style = {},
    placeholder,
  } = props;

  const [editor, setEditor] = useState<ImageEditorInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const generatedId = useId();
  const editorId = props.editorId || `image-editor-${generatedId}`;

  useImperativeHandle(ref, () => ({ editor }), [editor]);

  // Latest props, so async chain links and MountOptions callbacks always
  // see current values without remounting the editor.
  const latestPropsRef = useRef(props);
  useEffect(() => {
    latestPropsRef.current = props;
  });

  // All mount/destroy/reset operations run through this serialized chain:
  // a new mount can never start before the previous destroy finishes (the
  // editor throws on an occupied container), and image resets can never
  // overlap. Every link ends in .catch so a rejection never poisons it.
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  // The committed live instance; lets queued chain links detect that the
  // instance they were enqueued for has been replaced or unmounted.
  const editorRef = useRef<ImageEditorInstance | null>(null);
  // The image the live instance is currently showing.
  const appliedImageRef = useRef<string | null>(null);
  // The updateOptions-tier values the live instance last received.
  const appliedUpdatableRef = useRef<string | null>(null);

  const fail = (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    const { onError } = latestPropsRef.current;
    if (onError) {
      // A throwing onError must never escape: fail() runs as the terminal
      // .catch of the serialized chain, so a throw here would reject
      // chainRef and poison every subsequent link (see the invariant above).
      try {
        onError(err);
      } catch (callbackError) {
        console.error(
          '[react-image-editor] onError callback threw',
          callbackError
        );
      }
    } else {
      console.error('[react-image-editor]', err);
    }
  };

  // theme/locale/translations apply via updateOptions; everything else in
  // options requires a remount.
  const { theme, locale, translations, ...remountOptions } = options;
  const remountKey = JSON.stringify(remountOptions);
  const updatableKey = JSON.stringify([theme, locale, translations]);

  useEffect(() => {
    let cancelled = false;
    let instance: ImageEditorInstance | null = null;

    chainRef.current = chainRef.current
      .then(async () => {
        if (cancelled) return;
        await loadScript(scriptUrl);
        if (cancelled) return;

        const embed = window.ImageEditor;
        const container = containerRef.current;
        if (!embed) {
          throw new Error(
            'The embed script loaded but window.ImageEditor is unavailable.'
          );
        }
        // Defensive: React only detaches the ref on unmount, which the
        // cancelled check above already caught.
        /* v8 ignore next */
        if (!container) return;

        // Read at call time, not effect time: the image prop may have
        // moved on while a previous chain link was running.
        const current = latestPropsRef.current;
        const mountImage = current.image;
        const mountOptions = current.options || {};

        const created = await embed.createEditor({
          ...mountOptions,
          container,
          image: mountImage,
          onSave: (result) => latestPropsRef.current.onSave?.(result),
          onCancel: () => latestPropsRef.current.onCancel?.(),
          onLoadError: () => latestPropsRef.current.onLoadError?.(),
        });

        if (cancelled) {
          created.destroy();
          return;
        }

        instance = created;
        editorRef.current = created;
        appliedImageRef.current = mountImage;
        appliedUpdatableRef.current = JSON.stringify([
          mountOptions.theme,
          mountOptions.locale,
          mountOptions.translations,
        ]);
        setEditor(created);
        // The editor mounted successfully, so a throw from the consumer's
        // callback must not reach the terminal .catch below, where it would
        // surface as a wrapper failure and could hard-reset the loader.
        try {
          latestPropsRef.current.onLoad?.(created);
        } catch (callbackError) {
          console.error(
            '[react-image-editor] onLoad callback threw',
            callbackError
          );
        }
      })
      .catch((error) => {
        // If the versioned bundle never evaluated, the CDN loader has
        // cached a rejected promise it will return forever — hard-reset it
        // so the next mount attempt can retry from scratch. When the impl
        // global exists, the failure was a mount error; keep the loader.
        if (!window.__ImageEditorImpl__) {
          resetLoader(scriptUrl);
        }
        fail(error);
      });

    return () => {
      cancelled = true;
      editorRef.current = null;
      setEditor(null);
      chainRef.current = chainRef.current
        .then(() => {
          instance?.destroy();
          instance = null;
        })
        .catch(fail);
    };
  }, [scriptUrl, remountKey]);

  // Image changes apply through the chain as serialized resets: the
  // underlying reset is deeply async, so un-serialized resets could finish
  // out of order. Each link reads the latest image when it runs, which
  // collapses rapid changes to the final value.
  useEffect(() => {
    if (!editor) return;
    if (appliedImageRef.current === image) return;

    const instance = editor;
    chainRef.current = chainRef.current
      .then(async () => {
        if (editorRef.current !== instance) return;
        const target = latestPropsRef.current.image;
        if (target === appliedImageRef.current) return;
        await instance.reset(target);
        appliedImageRef.current = target;
      })
      .catch(fail);
  }, [editor, image]);

  useEffect(() => {
    if (!editor) return;
    // Skip instances already queued for destroy by a remount in the same
    // commit — the replacement mount re-records the applied values itself.
    if (editorRef.current !== editor) return;
    if (appliedUpdatableRef.current === updatableKey) return;
    appliedUpdatableRef.current = updatableKey;
    try {
      editor.updateOptions({ theme, locale, translations });
    } catch (error) {
      fail(error);
    }
  }, [editor, updatableKey]);

  // Rendered as an overlay sibling rather than a child of the mount
  // container: the embed owns that container's DOM, and React must not
  // reconcile children in and out from under it.
  const showPlaceholder = placeholder !== undefined && editor === null;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        minHeight: minHeight,
        // Only when needed, so existing layouts are untouched.
        ...(showPlaceholder ? { position: 'relative' } : null),
      }}
    >
      <div id={editorId} ref={containerRef} style={{ ...style, flex: 1 }} />
      {showPlaceholder && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
}

export const ImageEditor = React.forwardRef(ImageEditorInner);
