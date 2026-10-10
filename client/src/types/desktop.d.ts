export {};

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
