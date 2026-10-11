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

The component works out of the box in React Server Components environments (e.g. Next.js App Router) — it ships with the `'use client'` directive and touches the DOM only inside effects.

## Props

| Prop               | Type                          | Description                                                                                                                                                                            |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `image`            | `string` (required)           | Image URL or base64 data URL to edit.                                                                                                                                                  |
| `options`          | `ImageEditorOptions`          | Editor configuration: `projectId`, `user`, `features`, `theme`, `locale`, `translations`, `env`, `offline`, `licenseUrl`, `defaultPrompt`, `autoSubmitPrompt`, `aiAssistantOpenState`. |
| `editorId`         | `string`                      | id for the container div. Cosmetic — the editor mounts by element reference.                                                                                                           |
| `minHeight`        | `number \| string`            | Minimum height of the editor container. Defaults to `500`. Pass `0` (or `'100%'`) in a full-height layout so the editor fits a phone-sized viewport instead of overflowing it.         |
| `style`            | `CSSProperties`               | Styles applied to the container div. Overrides the default `flex: 1`.                                                                                                                  |
| `className`        | `string`                      | Class name for the container div — the hook for a breakpoint or a stylesheet.                                                                                                          |
| `wrapperStyle`     | `CSSProperties`               | Styles applied to the outer wrapper div, which owns `minHeight` and the flex layout. Set this to drop the editor into a non-flex layout.                                               |
| `wrapperClassName` | `string`                      | Class name for the outer wrapper div.                                                                                                                                                  |
| `ariaLabel`        | `string`                      | Accessible name for the editor region. Defaults to `'Image editor'`.                                                                                                                   |
| `onLoad`           | `(editor) => void`            | Called with the editor instance once it is mounted.                                                                                                                                    |
| `onSave`           | `({ dataUrl, blob }) => void` | Called when the user saves the edited image.                                                                                                                                           |
| `onCancel`         | `() => void`                  | Called when the user cancels editing.                                                                                                                                                  |
| `onLoadError`      | `() => void`                  | Called when the image fails to load into the canvas (CORS, 404, decode error).                                                                                                         |
| `onError`          | `(error: Error) => void`      | Wrapper-level failures: embed script load, editor creation, or image reset. Falls back to `console.error` when absent.                                                                 |

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

## Sizing and mobile

The editor fills the container it is given. It has no desktop/phone layout switch of its own — the
tool rail, panels and toolbar come from the embed bundle — so a small screen is about the three
rules below, plus a breakpoint of your own if you want to rearrange that chrome.

**The wrapper never widens its parent.** A flex item defaults to `min-width: auto`, refusing to
shrink below its content, and this editor's content is very wide: the sticker and shape panels lay
hundreds of tiles out in rows that never wrap. Both the wrapper and the container therefore default
to `min-width: 0`, so a narrow container really does constrain the editor and those wide rows scroll
inside their own panel. (`style` / `wrapperStyle` can put the old behaviour back.)

**Give the container a definite height.** The wrapper owns `minHeight`, which defaults to `500`. In
a full-height layout pass `minHeight={0}` or `minHeight="100%"`; otherwise a phone viewport overflows
and the whole page scrolls.

**Adapt the embed's chrome with a breakpoint.** `className` and `wrapperClassName` reach the container
and the wrapper, so a stylesheet can target what the embed renders inside them:

```css
@media (max-width: 640px) {
  .my-editor .image-editor-root .toolbar {
    /* ... */
  }
}
```

The embed's own class names are not part of this component's API — pin `scriptUrl` to a specific
editor version before depending on them.

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

## Localization

Set `options.locale` (bundled: `en`, `es`, `fr`, `de`, `it`, `pt`, `nl`, `ja`, `ko`, `zh`) and optionally override strings with `options.translations`.

## Demo

Try the live demo at [react-image-editor-example.vercel.app](https://react-image-editor-example.vercel.app/), or run it locally — a Vite-based demo lives in [`demo/`](demo). From the repository root, with [pnpm](https://pnpm.io/installation) installed:

```sh
pnpm install
pnpm dev
```

## License

Copyright (c) 2026 Unlayer. [MIT](LICENSE) Licensed.
