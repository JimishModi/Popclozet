/// <reference types="vite/client" />

declare const __SW_VERSION__: string;

declare module "virtual:pwa-register" {
  export function registerSW(options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegisterError?: (error: any) => void;
  }): void;
}
