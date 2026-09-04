# React Image Editor

[![npm version](https://img.shields.io/npm/v/@unlayer/react-image-editor.svg)](https://www.npmjs.com/package/@unlayer/react-image-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/unlayer/react-image-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/unlayer/react-image-editor/actions/workflows/ci.yml)

The excellent [Unlayer Image Editor](https://unlayer.com/image-editor) as a React.js wrapper component — crop, resize, draw, text, shapes, stickers, frames, filters, and an optional AI Assistant.

<img width="1536" height="1024" alt="react-image-editor-text" src="https://github.com/user-attachments/assets/99bea489-4b82-4e35-bb37-34d1e11e05d5" />

## Live Demo

Try the live demo: [react-image-editor-example.vercel.app](https://react-image-editor-example.vercel.app/)

## Installation

```sh
npm install @unlayer/react-image-editor
```

## Usage

Requires React >= 18.

```jsx
import React, { useRef } from 'react';
import ImageEditor from '@unlayer/react-image-editor';

const App = () => {
  const editorRef = useRef(null);

  return (
    <ImageEditor
      ref={editorRef}
      image="https://example.com/photo.jpg"
      options={{ theme: 'light' }}
      onSave={({ dataUrl, blob }) => {
        // Persist the edited image
        console.info('Saved', dataUrl.length, 'bytes');
      }}
      onCancel={() => console.info('Editing cancelled')}
    />
  );
};
```

### TypeScript

Every type is exported from the package root:

```tsx
import { useRef } from 'react';
import ImageEditor, {
  type ImageEditorOptions,
  type ImageEditorRef,
  type ImageEditorSaveResult,
} from '@unlayer/react-image-editor';

const options: ImageEditorOptions = { theme: 'dark', locale: 'fr' };

export function Editor({ image }: { image: string }) {
  const editorRef = useRef<ImageEditorRef>(null);

  const save = (result: ImageEditorSaveResult) => {
    console.info(result.dataUrl, result.blob);
  };

  return (
    <ImageEditor
      ref={editorRef}
      image={image}
      options={options}
      onSave={save}
    />
  );
}
```

| Type                    | What it is                                                  |
| ----------------------- | ----------------------------------------------------------- |
| `ImageEditorProps`      | The component's full prop type.                             |
| `ImageEditorOptions`    | The `options` prop — everything the component does not own. |
| `ImageEditorRef`        | The ref shape, `{ editor }`.                                |
| `ImageEditorInstance`   | The editor instance and its methods.                        |
| `ImageEditorSaveResult` | `{ dataUrl, blob }`, passed to `onSave`.                    |

The component works out of the box in React Server Components environments (e.g. Next.js App Router) — it ships with the `'use client'` directive and touches the DOM only inside effects.

## Props

| Prop          | Type                          | Description                                                                                                                                                                                                     |
| ------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`       | `string` (required)           | Image URL or base64 data URL to edit.                                                                                                                                                                           |
| `options`     | `ImageEditorOptions`          | Editor configuration: `projectId`, `user`, `features`, `theme`, `locale`, `translations`, `env`, `offline`, `licenseUrl`, `defaultPrompt`, `autoSubmitPrompt`, `aiAssistantOpenState`.                          |
| `editorId`    | `string`                      | id for the container div. Cosmetic — the editor mounts by element reference.                                                                                                                                    |
| `minHeight`   | `number \| string`            | Minimum height of the editor container. Defaults to `500`.                                                                                                                                                      |
| `style`       | `CSSProperties`               | Styles applied to the container div.                                                                                                                                                                            |
| `scriptUrl`   | `string`                      | Override the embed script URL, e.g. to pin an environment. One embed per page: the first loader to run installs `window.ImageEditor` and wins globally, so do not mix different `scriptUrl`s across components. |
| `onLoad`      | `(editor) => void`            | Called with the editor instance once it is mounted.                                                                                                                                                             |
| `onSave`      | `({ dataUrl, blob }) => void` | Called when the user saves the edited image.                                                                                                                                                                    |
| `onCancel`    | `() => void`                  | Called when the user cancels editing.                                                                                                                                                                           |
| `onLoadError` | `() => void`                  | Called when the image fails to load into the canvas (CORS, 404, decode error).                                                                                                                                  |
| `onError`     | `(error: Error) => void`      | Wrapper-level failures: embed script load, editor creation, or image reset. Falls back to `console.error` when absent.                                                                                          |

## Editor instance (ref)

The `ref` exposes `{ editor }` — `null` until the editor mounts, then an instance with:

| Method                   | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| `getImage()`             | Current canvas as a data URL (flattened), or `null`.                         |
| `hasChanges()`           | Whether there are unsaved edits.                                             |
| `reset(imageUrl?)`       | Reset editor state (clears undo/redo and chat), optionally load a new image. |
| `updateOptions(partial)` | Update options like `theme` / `locale` at runtime.                           |
| `destroy()`              | Unmount the editor (the component does this automatically on unmount).       |

```jsx
const dataUrl = editorRef.current?.editor?.getImage();
```

## How prop changes are applied

| Change                                                       | Behavior                                                                                                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `image`                                                      | Applied via `reset(newImage)` — **clears undo/redo history and AI chat**. Rapid changes are serialized and collapse to the latest value. |
| `options.theme`, `options.locale`, `options.translations`    | Applied via `updateOptions()` — no remount, editor state preserved.                                                                      |
| Any other `options` key                                      | Full remount — the editor is destroyed and recreated with the new configuration.                                                         |
| `onSave` / `onCancel` / `onLoadError` / `onLoad` / `onError` | Always call the latest handler; changing them never remounts.                                                                            |

## Error handling

Two distinct channels:

- **`onLoadError`** — the editor loaded fine, but the _image_ couldn't be loaded into the canvas (CORS, dead URL, decode error).
- **`onError`** — the wrapper couldn't reach a working editor: the embed script failed to load, editor creation was rejected, or re-applying a changed `image` failed. After a CDN failure the wrapper automatically resets its loader state, so a later remount retries from scratch.

## Tools

The editor ships eight tools, rendered as a tab rail beside the canvas:

| Tool       | What it does                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------- |
| `crop`     | Crop with rotate (90° steps), flip, and a straighten slider.                                   |
| `resize`   | Change the output dimensions.                                                                  |
| `filter`   | One-tap presets plus adjustment sliders (brightness, contrast, saturation, hue, blur, noise…). |
| `draw`     | Freehand brush with color, type, and size controls.                                            |
| `text`     | Text layers with style presets, fonts, color/background/outline/shadow.                        |
| `shapes`   | Filled/outline/gradient shape palettes with drag, resize, rotate, and styling.                 |
| `stickers` | A bundled sticker library grouped by category, with color/outline/shadow for vector sets.      |
| `frame`    | Frame presets with a size slider and color picker.                                             |

All tools are enabled by default. Configure them through `options.features.imageEditor.tools` — each entry is either a `boolean` shorthand or `{ enabled?: boolean; icon?: string }`:

```jsx
// Hide the tools you don't want
<ImageEditor
  image={url}
  options={{
    features: {
      imageEditor: {
        dock: 'left',
        tools: {
          corners: false,
          draw: false,
          stickers: false,
          frame: { enabled: false }, // object form, same effect
        },
      },
    },
  }}
/>
```

```jsx
// Allow-list style: a minimal crop-and-filter editor
<ImageEditor
  image={url}
  options={{
    features: {
      imageEditor: {
        tools: {
          resize: false,
          draw: false,
          text: false,
          shapes: false,
          stickers: false,
          frame: false,
          // crop and filter stay enabled by default
        },
      },
    },
  }}
/>
```

```jsx
// Custom tool icon: a URL, raw <svg>…</svg> markup, or a Font Awesome name
<ImageEditor
  image={url}
  options={{
    features: {
      imageEditor: {
        tools: {
          crop: { icon: 'fa-crop-simple' },
          text: { icon: 'https://example.com/icons/text.svg' },
        },
      },
    },
  }}
/>
```

Two things to keep in mind:

- `features` is a remount-tier option (see the table above): changing the tools config destroys and recreates the editor, discarding unsaved edits — decide the toolset before mounting rather than toggling it live.
- `features.imageEditor: false` disables the editing UI entirely. Use `features.imageEditor.dock: 'left' | 'right'` to position the tool rail; the rounded-corners control inside Crop is configured through `features.imageEditor.tools.corners`.

## AI Assistant

The editor includes an optional AI Assistant for chat-based edits. It requires a `projectId` from your [Unlayer account](https://console.unlayer.com/) with the feature enabled.

<img width="1690" height="931" alt="react-image-editor-ai" src="https://github.com/user-attachments/assets/990effdb-5c8b-4b5d-abf4-804bfefaf273" />

### Enable AI Assistant

```jsx
<ImageEditor
  image={url}
  options={{
    projectId: 1234, // get from console
    features: { ai: { enabled: true, assistant: true } },
  }}
/>
```

## Offline and self-hosted assets

By default the editor talks to Unlayer's APIs and loads its assets (fonts, frames, stickers) from the CDN. Three options change that:

| Option       | Type      | Purpose                                                                                                 |
| ------------ | --------- | ------------------------------------------------------------------------------------------------------- |
| `offline`    | `boolean` | Skips all external API calls. AI features are unavailable; entitlements come from `licenseUrl` instead. |
| `licenseUrl` | `string`  | URL to the encrypted `license.json` used in offline mode to load entitlements.                          |
| `env`        | `object`  | Runtime overrides for base URLs. Takes precedence over build-time env vars.                             |

```jsx
<ImageEditor
  image={url}
  options={{
    offline: true,
    licenseUrl: '/assets/license.json',
    env: {
      // Point the editor at assets bundled inside your own app.
      IMAGE_EDITOR_BASE_URL: '/assets/image-editor/',
      API_V2_BASE_URL: 'https://api.example.com/v2',
      API_V3_BASE_URL: 'https://api.example.com/v3',
    },
  }}
/>
```

`env` is a remount-tier option — set it before mounting rather than toggling it live.

## Localization

Set `options.locale` (bundled: `en`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `ja`, `ko`, `zh`) and optionally override strings with `options.translations`.

## Demo

Try the live demo at [react-image-editor-example.vercel.app](https://react-image-editor-example.vercel.app/), or run it locally — a Vite-based demo lives in [`demo/`](demo):

```sh
cd demo
npm install
npm run dev
```

## License

Copyright (c) 2026 Unlayer. [MIT](LICENSE) Licensed.
