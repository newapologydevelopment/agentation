/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINPOINT_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
