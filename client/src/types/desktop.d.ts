export {};

interface DesktopUpdateStatus {
  status: string;
  message: string;
  version: string | null;
  available: boolean;
  downloaded: boolean;
  checkedAt: string | null;
}

declare global {
  interface Window {
    qbzDesktop?: {
      isDesktop: boolean;
      app: {
        getVersion: () => Promise<string>;
        selectFolder: (defaultPath?: string) => Promise<string | null>;
      };
      window: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizeChanged: (callback: (maximized: boolean) => void) => () => void;
      };
      updates: {
        getStatus: () => Promise<DesktopUpdateStatus>;
        check: () => Promise<{ ok: boolean; reason?: string }>;
        install: () => Promise<{ ok: boolean; reason?: string }>;
        onStatusChanged: (callback: (status: DesktopUpdateStatus) => void) => () => void;
      };
      miniPlayer: {
        toggle: () => Promise<void>;
        isOpen: () => Promise<boolean>;
        sendPlayerEvent: (type: string, data: any) => void;
        onPlayerEvent: (callback: (type: string, data: any) => void) => () => void;
      };
      getSystemTheme: () => Promise<'dark' | 'light'>;
      onSystemThemeChanged: (callback: (theme: 'dark' | 'light') => void) => () => void;
    };
  }
}
