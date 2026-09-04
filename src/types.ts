import { CSSProperties } from 'react';

import type {
  Features,
  UnlayerLocale,
  UnlayerTranslations,
  User,
} from '@unlayer/types';

/**
 * Result passed to onSave when the user saves the edited image.
 */
export interface ImageEditorSaveResult {
  dataUrl: string;
  blob: Blob;
}

// KEEP IN SYNC WITH packages/image-editor/src/index.ts in the unlayer
// monorepo — these mirror the private @unlayer/image-editor package's
// public API until they move into @unlayer/types.
//
// test/typesDrift.test.ts enforces the "until": it fails as soon as
// @unlayer/types exports any of these names, so the local copy gets deleted
// rather than left to diverge. It cannot detect the private package
// changing underneath us — that still needs a human.

/**
 * Options for mounting the image editor.
 */
export interface MountOptions {
  /** CSS selector or HTMLElement to mount the editor into */
  container: string | HTMLElement;
  /** Image URL or base64 data URL to edit */
  image: string;
  /** Project ID for authentication (required for AI features) */
  projectId?: number;
  /** Optional user identity for identity verification */
  user?: User;
  /** Feature flags to enable/disable specific features */
  features?: Features;
  /** Runtime overrides for API base URLs (takes precedence over build-time env vars) */
  env?: {
    API_V2_BASE_URL?: string;
    API_V3_BASE_URL?: string;
    /** Base URL for image-editor assets (fonts, frames, stickers). Override when bundled inside a host app. */
    IMAGE_EDITOR_BASE_URL?: string;
  };
  /** Editor color theme */
  theme?: 'light' | 'dark';
  /** Active language code (e.g., 'es', 'fr') */
  locale?: UnlayerLocale;
  /** Custom translations keyed by language code */
  translations?: UnlayerTranslations;
  /** Enable offline mode - skips all external API calls */
  offline?: boolean;
  /** URL to the encrypted license.json file (used in offline mode to load entitlements) */
  licenseUrl?: string;
  /** Default prompt to pre-fill in the AI chat input. */
  defaultPrompt?: string;
  /** Whether to automatically submit the default prompt on load. */
  autoSubmitPrompt?: boolean;
  /** Whether the AI Assistant panel should be open or closed when the editor is ready. Defaults to 'open'. */
  aiAssistantOpenState?: 'open' | 'closed';
  /** Callback when image is saved */
  onSave?: (result: ImageEditorSaveResult) => void;
  /** Callback when editing is cancelled */
  onCancel?: () => void;
  /**
   * Callback when the image fails to load into the canvas (CORS, a dead
   * proxy/URL, a 404, or a decode error).
   */
  onLoadError?: () => void;
}

/**
 * Instance returned by createEditor() for controlling the editor.
 */
export interface ImageEditorInstance {
  /** Unmount and cleanup the editor */
  destroy(): void;
  /** Get the current image as a data URL */
  getImage(): string | null;
  /** Whether the editor has unsaved changes (edits or AI-applied changes) */
  hasChanges(): boolean;
  /** Update editor options (theme, locale, etc.) */
  updateOptions(newOptions: Partial<MountOptions>): void;
  /** Reset editor state (clear chat, undo/redo, reload image) */
  reset(imageUrl?: string): void | Promise<void>;
}

/**
 * Editor configuration accepted through the component's `options` prop —
 * everything in MountOptions except the fields the component owns.
 */
export type ImageEditorOptions = Omit<
  MountOptions,
  'container' | 'image' | 'onSave' | 'onCancel' | 'onLoadError'
>;

export interface ImageEditorProps {
  /** Image URL or data URL to edit. Changes apply via a serialized reset. */
  image: string;
  /** Editor configuration (theme, locale, projectId, features, ...). */
  options?: ImageEditorOptions;
  /** id for the container div. Cosmetic — the editor mounts by element. */
  editorId?: string;
  /** Minimum height of the editor container. Defaults to 500. */
  minHeight?: number | string;
  /** Styles applied to the container div. */
  style?: CSSProperties;
  /**
   * Override the embed script URL (e.g. to pin an environment). One embed
   * per page: the first loader to run installs window.ImageEditor and wins
   * globally, so do not mix different scriptUrls across components.
   */
  scriptUrl?: string;
  /** Called with the editor instance once it is mounted. */
  onLoad?(editor: ImageEditorInstance): void;
  /**
   * Wrapper-level failure: embed-script load, createEditor, or reset
   * re-apply rejection. NOT in-editor image decode — that's onLoadError.
   * When absent, failures fall back to console.error.
   */
  onError?(error: Error): void;
  /** Called when the user saves the edited image. */
  onSave?(result: ImageEditorSaveResult): void;
  /** Called when the user cancels editing. */
  onCancel?(): void;
  /** Called when the image fails to load into the canvas (decode/CORS/404). */
  onLoadError?(): void;
}

export interface ImageEditorRef {
  editor: ImageEditorInstance | null;
}

/**
 * The API installed on window.ImageEditor by the CDN embed loader.
 */
export interface ImageEditorEmbed {
  load(opts?: { version?: string }): Promise<void>;
  createEditor(options: MountOptions): Promise<ImageEditorInstance>;
  baseUrl: string;
}

declare global {
  interface Window {
    ImageEditor?: ImageEditorEmbed;
    /**
     * Assigned by the versioned bundle when it evaluates; its absence after
     * a createEditor rejection identifies a bundle-load failure (see
     * loadScript's resetLoader).
     */
    __ImageEditorImpl__?: unknown;
  }
}
