import React, { useRef, useState } from 'react';

import ImageEditor, {
  ImageEditorRef,
  ImageEditorSaveResult,
} from '@unlayer/react-image-editor';
import type { UnlayerLocale } from '@unlayer/types';

import Sidebar, { TOOL_NAMES, ToolName } from './Sidebar';

const SAMPLE_IMAGES = [
  'https://picsum.photos/id/1015/1200/800',
  'https://picsum.photos/id/1025/1200/800',
  'https://picsum.photos/id/1040/1200/800',
];

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// The AI Assistant needs a projectId with the feature enabled, so the demo
// only offers it when one is configured. See demo/.env.example.
const PROJECT_ID = Number(import.meta.env.VITE_UNLAYER_PROJECT_ID) || undefined;

// Demonstrates features.imageEditor.tools.<tool>.icon. Raw <svg> markup is
// the form that works today; see #64 for the Font Awesome name form.
const CUSTOM_TEXT_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7V5h16v2M12 5v14M9 19h6" /></svg>';

const allToolsEnabled = () =>
  Object.fromEntries(TOOL_NAMES.map((tool) => [tool, true])) as Record<
    ToolName,
    boolean
  >;

export default function App() {
  const editorRef = useRef<ImageEditorRef>(null);

  const [image, setImage] = useState(SAMPLE_IMAGES[0]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [locale, setLocale] = useState<UnlayerLocale>('en');
  const [tools, setTools] =
    useState<Record<ToolName, boolean>>(allToolsEnabled);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dock, setDock] = useState<'left' | 'right'>('right');
  const [ai, setAi] = useState(false);
  const [saved, setSaved] = useState<ImageEditorSaveResult | null>(null);
  const [status, setStatus] = useState('Loading editor…');

  // Invalidates in-flight file reads so a slow read can never overwrite a
  // newer image choice (upload or sample) after the fact.
  const readTokenRef = useRef(0);
  const readerRef = useRef<FileReader | null>(null);

  const nextImage = () => {
    readTokenRef.current++;
    readerRef.current?.abort();
    const index = SAMPLE_IMAGES.indexOf(image);
    setImage(SAMPLE_IMAGES[(index + 1) % SAMPLE_IMAGES.length]);
    setStatus('Image changed (reset)');
  };

  const uploadImage = (file: File) => {
    // accept="image/*" is only a picker hint — enforce type and size here.
    if (!file.type.startsWith('image/')) {
      setStatus(`"${file.name}" is not an image`);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus(`"${file.name}" is too large (max 20 MB)`);
      return;
    }
    readerRef.current?.abort();
    const token = ++readTokenRef.current;
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => {
      if (token !== readTokenRef.current) return;
      setImage(reader.result as string);
      setStatus(`Loaded "${file.name}" (reset)`);
    };
    reader.onerror = () => {
      if (token !== readTokenRef.current) return;
      console.error('[demo] file read failed', reader.error);
      setStatus(`Could not read "${file.name}"`);
    };
    reader.readAsDataURL(file);
  };

  const checkChanges = () => {
    const editor = editorRef.current?.editor;
    if (!editor) return;
    setStatus(editor.hasChanges() ? 'Unsaved changes' : 'No unsaved changes');
  };

  const snapshot = async () => {
    const dataUrl = editorRef.current?.editor?.getImage();
    if (!dataUrl) return;
    // Build the real blob rather than an empty one: this object is shaped
    // like an ImageEditorSaveResult, so it should not lie about `blob`.
    const blob = await (await fetch(dataUrl)).blob();
    setSaved({ dataUrl, blob });
    setStatus(`Snapshot taken via getImage() (${blob.size} bytes)`);
  };

  const toggleTool = (tool: ToolName) => {
    setTools((previous) => ({ ...previous, [tool]: !previous[tool] }));
    setStatus(`Tool "${tool}" toggled (remount)`);
  };

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="sidebar-toggle"
          aria-label="Toggle controls"
          title="Toggle controls"
          onClick={() => setSidebarOpen((open) => !open)}
        >
          ☰
        </button>
        <h1>React Image Editor</h1>
        <span className="status">{status}</span>
      </header>

      <div className="body">
        {sidebarOpen && (
          <Sidebar
            theme={theme}
            onThemeChange={setTheme}
            locale={locale}
            onLocaleChange={setLocale}
            tools={tools}
            onToolToggle={toggleTool}
            dock={dock}
            onDockChange={(next) => {
              setDock(next);
              setStatus('Tool rail moved (remount)');
            }}
            aiAvailable={PROJECT_ID !== undefined}
            ai={ai}
            onAiChange={(enabled) => {
              setAi(enabled);
              setStatus(
                `AI Assistant ${enabled ? 'enabled' : 'disabled'} (remount)`
              );
            }}
            onChangeImage={nextImage}
            onUploadImage={uploadImage}
            onCheckChanges={checkChanges}
            onSnapshot={snapshot}
          />
        )}

        <main className="editor">
          <ImageEditor
            ref={editorRef}
            image={image}
            options={{
              theme,
              locale,
              projectId: PROJECT_ID,
              features: {
                ai: { enabled: ai, assistant: ai },
                imageEditor: {
                  dock,
                  tools: {
                    ...tools,
                    // A tool entry can also be an object, which is how a
                    // custom icon is supplied. Raw <svg> markup, not a Font
                    // Awesome name — the name form is silently ignored
                    // (see #64).
                    text: {
                      enabled: tools.text,
                      icon: CUSTOM_TEXT_ICON,
                    },
                  },
                },
              },
            }}
            onLoad={() => setStatus('Editor ready')}
            onSave={(result) => {
              setSaved(result);
              setStatus('Saved!');
            }}
            onCancel={() => setStatus('Cancelled')}
            onLoadError={() => setStatus('Image failed to load')}
            onError={(error) => setStatus(`Error: ${error.message}`)}
          />
        </main>
      </div>

      {saved && (
        <aside className="preview">
          <div className="preview-header">
            <h2>Saved result</h2>
            <a href={saved.dataUrl} download="edited-image.png">
              Download
            </a>
            <button onClick={() => setSaved(null)}>Close</button>
          </div>
          <img src={saved.dataUrl} alt="Saved result" />
        </aside>
      )}
    </div>
  );
}
