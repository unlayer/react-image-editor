/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional Unlayer projectId; enables the AI Assistant controls. */
  readonly VITE_UNLAYER_PROJECT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
