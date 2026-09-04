import React, { useRef } from 'react';

import type { UnlayerLocale } from '@unlayer/types';

export const TOOL_NAMES = [
  'crop',
  'resize',
  'filter',
  'draw',
  'text',
  'shapes',
  'stickers',
  'frame',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

const LOCALES: { value: UnlayerLocale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'ja', label: '日本語' },
];

interface SidebarProps {
  theme: 'light' | 'dark';
  onThemeChange(theme: 'light' | 'dark'): void;
  locale: UnlayerLocale;
  onLocaleChange(locale: UnlayerLocale): void;
  dock: 'left' | 'right';
  onDockChange(dock: 'left' | 'right'): void;
  tools: Record<ToolName, boolean>;
  onToolToggle(tool: ToolName): void;
  onChangeImage(): void;
  onUploadImage(file: File): void;
  onCheckChanges(): void;
  onSnapshot(): void;
}

export default function Sidebar(props: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="sidebar">
      <section className="section">
        <h2 className="section-label">Actions</h2>
        <button onClick={props.onChangeImage}>Change image</button>
        <button onClick={() => fileInputRef.current?.click()}>
          Upload image…
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clear before the callback so re-selecting the same file always
            // fires onChange, even if the handler throws.
            event.target.value = '';
            if (file) props.onUploadImage(file);
          }}
        />
        <button onClick={props.onCheckChanges}>Has changes?</button>
        <button onClick={props.onSnapshot}>Snapshot</button>
      </section>

      <section className="section">
        <h2 className="section-label">Options (live)</h2>
        <label className="field">
          Theme
          <select
            value={props.theme}
            onChange={(event) =>
              props.onThemeChange(event.target.value as 'light' | 'dark')
            }
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="field">
          Locale
          <select
            value={props.locale}
            onChange={(event) =>
              props.onLocaleChange(event.target.value as UnlayerLocale)
            }
          >
            {LOCALES.map((locale) => (
              <option key={locale.value} value={locale.value}>
                {locale.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="section">
        <h2 className="section-label">Dock (remounts editor)</h2>
        <label className="field">
          Toolbar position
          <select
            value={props.dock}
            onChange={(event) =>
              props.onDockChange(event.target.value as 'left' | 'right')
            }
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </label>
      </section>

      <section className="section">
        <h2 className="section-label">Tools (remounts editor)</h2>
        <div className="tool-grid">
          {TOOL_NAMES.map((tool) => (
            <label key={tool} className="tool-toggle">
              <input
                type="checkbox"
                checked={props.tools[tool]}
                onChange={() => props.onToolToggle(tool)}
              />
              {tool}
            </label>
          ))}
        </div>
      </section>
    </aside>
  );
}
