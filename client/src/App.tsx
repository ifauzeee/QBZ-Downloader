import { useState, useEffect, useCallback } from 'react';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { NavigationProvider, useNavigation, type Tab } from './contexts/NavigationContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PlayerProvider } from './contexts/PlayerContext';
import { motion, AnimatePresence } from 'framer-motion';
import { QueueView } from './components/QueueView';
import { BatchImportView } from './components/BatchImportView';
import { SearchView } from './components/SearchView';
import { AlbumDetailView } from './components/AlbumDetailView';
import { ArtistDetailView } from './components/ArtistDetailView';
import { ArtistListView } from './components/ArtistListView';
import { Player } from './components/Player';
import { AnalyticsView } from './components/AnalyticsView';
import { LibraryView } from './components/LibraryView';
import { PlaylistsView } from './components/PlaylistsView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { LogView } from './components/LogView';
import { LibraryHealthView } from './components/LibraryHealthView';
import { AddUrlModal, LoginModal } from './components/Modals';
import { DesktopSetupGate } from './components/DesktopSetupGate';


import { CommandPalette } from './components/CommandPalette';
import { DropZone } from './components/DropZone';
import { QueuePanel } from './components/QueuePanel';
import { Icons } from './components/Icons';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyAccent } from './utils/theme';
import { smartFetch } from './utils/api';

type UpdateState = {
  status: string;
  message: string;
  version: string | null;
  available: boolean;
  downloaded: boolean;
  checkedAt: string | null;
};

type DesktopSetupState = 'checking' | 'required' | 'ready';

type OnboardingStatusResponse = {
  configured: boolean;
};

function AppContent() {
  const { activeTab, setActiveTab } = useNavigation();
  const { connected } = useSocket();
  const { t, language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isMaximized, setIsMaximized] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [showLangMenu, setShowLangMenu] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const desktopBridge = typeof window !== 'undefined' ? window.qbzDesktop : undefined;
  const isDesktop = Boolean(desktopBridge?.isDesktop);
  const [desktopSetupState, setDesktopSetupState] = useState<DesktopSetupState>(
    isDesktop ? 'checking' : 'ready'
  );

  useEffect(() => {
    document.body.classList.remove('dark-theme', 'light-theme');
    document.body.classList.add(`${theme}-theme`);
    document.body.classList.toggle('desktop-mode', isDesktop);
    localStorage.setItem('theme', theme);

    return () => {
      document.body.classList.remove('desktop-mode');
    };
  }, [theme, isDesktop]);

  useEffect(() => {
    const accent = localStorage.getItem('accent') || '#2dd4bf';
    applyAccent(accent);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const closeMenu = () => setShowLangMenu(false);
    if (showLangMenu) window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, [showLangMenu]);

  useEffect(() => {
    const handleAuthError = () => {
      setShowLoginModal(true);
    };
    window.addEventListener('auth:unauthorized', handleAuthError);
    return () => window.removeEventListener('auth:unauthorized', handleAuthError);
  }, []);

  useEffect(() => {
    if (!isDesktop || !desktopBridge) return;

    let cleanup: (() => void) | undefined;
    desktopBridge.window
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => setIsMaximized(false));

    cleanup = desktopBridge.window.onMaximizeChanged((maximized) => {
      setIsMaximized(maximized);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [desktopBridge, isDesktop]);

  useEffect(() => {
    if (!isDesktop || !desktopBridge) return;

    desktopBridge.updates
      .getStatus()
      .then((status) => setUpdateState(status))
      .catch(() => undefined);

    const cleanup = desktopBridge.updates.onStatusChanged((status) => {
      setUpdateState(status);
      setIsCheckingUpdate(status.status === 'checking' || status.status === 'downloading');
    });

    return () => cleanup();
  }, [desktopBridge, isDesktop]);

  const checkDesktopSetup = useCallback(async () => {
    if (!isDesktop) {
      setDesktopSetupState('ready');
      return;
    }

    setDesktopSetupState('checking');
    try {
      const res = await smartFetch('/api/onboarding');
      if (!res || !res.ok) {
        setDesktopSetupState('required');
        return;
      }

      const data = (await res.json()) as OnboardingStatusResponse;
      setDesktopSetupState(data.configured ? 'ready' : 'required');
    } catch {
      setDesktopSetupState('required');
    }
  }, [isDesktop]);

  useEffect(() => {
    void checkDesktopSetup();
  }, [checkDesktopSetup]);

  const handleDesktopSetupContinue = useCallback(() => {
    setDesktopSetupState('ready');
  }, []);

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };
  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const handleOpenGithub = () => {
    window.open('https://github.com/ifauzeee/QBZ-Downloader', '_blank', 'noopener,noreferrer');
  };

  const flags: Record<string, { icon: any; label: string; name: string }> = {
    en: { icon: Icons.FlagUS, label: 'EN', name: 'English' },
    id: { icon: Icons.FlagID, label: 'ID', name: 'Bahasa' },
    es: { icon: Icons.FlagES, label: 'ES', name: 'Espanol' },
    fr: { icon: Icons.FlagFR, label: 'FR', name: 'Francais' },
    de: { icon: Icons.FlagDE, label: 'DE', name: 'Deutsch' },
    ja: { icon: Icons.FlagJA, label: 'JA', name: 'Japanese' },
    zh: { icon: Icons.FlagZH, label: 'ZH', name: 'Chinese' },
    hi: { icon: Icons.FlagIN, label: 'HI', name: 'Hindi' },
    tr: { icon: Icons.FlagTR, label: 'TR', name: 'Turkish' }
  };

  const navItems: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'queue', icon: <Icons.Queue />, label: t('menu_queue') },
    { id: 'search', icon: <Icons.Search />, label: t('menu_search') },
    { id: 'batch', icon: <Icons.Batch />, label: t('menu_batch') },
    { id: 'statistics', icon: <Icons.Analytics />, label: t('menu_analytics') },
    { id: 'health', icon: <Icons.Security />, label: 'Library Health' },
    { id: 'library', icon: <Icons.Library />, label: t('menu_library') },
    { id: 'playlists', icon: <Icons.Playlist />, label: t('menu_playlists') },
    { id: 'history', icon: <Icons.History />, label: t('menu_history') },
    { id: 'logs', icon: <Icons.Logs />, label: 'System Logs' },
    { id: 'settings', icon: <Icons.Settings />, label: t('menu_settings') }
  ];

  const getPageTitle = (tab: Tab) => {
    const titles: Record<string, string> = {
      queue: t('title_queue'),
      search: t('title_search'),
      batch: t('title_batch'),
      statistics: t('title_analytics'),
      health: 'Library Health',
      library: t('title_library'),
      playlists: t('title_playlists'),
      history: t('title_history'),
      logs: 'System Logs',
      settings: t('title_settings'),
      album: t('title_album'),
      artist: t('title_artist'),
      artist_albums: 'Artist Albums',
      artist_tracks: 'Artist Tracks'
    };
    return titles[tab] || t('title_dashboard');
  };

  const handleMinimize = () => {
    if (desktopBridge) {
      void desktopBridge.window.minimize();
    }
  };

  const handleMaximizeToggle = () => {
    if (desktopBridge) {
      void desktopBridge.window.toggleMaximize();
    }
  };

  const handleClose = () => {
    if (desktopBridge) {
      void desktopBridge.window.close();
    }
  };

  const handleCheckUpdate = () => {
    if (!desktopBridge) return;
    setIsCheckingUpdate(true);
    desktopBridge.updates
      .check()
      .catch(() => undefined)
      .finally(() => setIsCheckingUpdate(false));
  };

  const handleInstallUpdate = () => {
    if (!desktopBridge) return;
    void desktopBridge.updates.install();
  };

  const getUpdateLabel = () => {
    if (!updateState) return 'Updates';
    if (updateState.downloaded) return 'Update Ready';
    if (updateState.status === 'disabled') return 'Update Disabled';
    if (updateState.status === 'downloading') return 'Updating...';
    if (updateState.status === 'checking') return 'Checking...';
    if (updateState.status === 'available') return 'Update Found';
    if (updateState.status === 'up-to-date') return 'Up to Date';
    if (updateState.status === 'error') return 'Update Error';
    return 'Updates';
  };
  



  return (
    <div className="app-shell">
      <ErrorBoundary>
        <DropZone>
          <CommandPalette />
          {isDesktop && (
            <header className="desktop-titlebar">
              <div className="desktop-titlebar-brand">
                <span className="desktop-titlebar-logo">QBZ</span>
                <span>QBZ Downloader Desktop</span>
              </div>
              <div className="desktop-window-controls">
                <button className="window-control" aria-label="Minimize window" onClick={handleMinimize}>
                  <Icons.Minimize width={14} height={14} />
                </button>
                <button
                  className="window-control"
                  aria-label="Toggle maximize window"
                  onClick={handleMaximizeToggle}
                >
                  {isMaximized ? (
                    <Icons.Archive width={14} height={14} />
                  ) : (
                    <Icons.Maximize width={14} height={14} />
                  )}
                </button>
                <button className="window-control danger" aria-label="Close window" onClick={handleClose}>
                  <Icons.Close width={14} height={14} />
                </button>
              </div>
            </header>
          )}

          {isDesktop && desktopSetupState !== 'ready' ? (
            <section className="desktop-onboarding-entry">
              {desktopSetupState === 'checking' ? (
                <div className="desktop-onboarding-loading">
                  <div className="desktop-onboarding-spinner" />
                  <p>Checking your local setup status...</p>
                </div>
              ) : (
                <DesktopSetupGate onContinue={handleDesktopSetupContinue} />
              )}
            </section>
          ) : (
            <div className="app-container">
              <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="logo">
                  <span className="logo-icon">🎵</span>
                  <h1 style={{ whiteSpace: 'nowrap' }}>QBZ-DL</h1>
                </div>
                <nav className="nav-menu">
                  {navItems.map((item) => (
                    <a
                      key={item.id}
                      href="#"
                      className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      title={sidebarCollapsed ? item.label : ''}
                    >
                      <span className="icon">{item.icon}</span>{' '}
                      <span className="nav-label">{item.label}</span>
                    </a>
                  ))}
                </nav>
                <div className="sidebar-footer">
                  <p
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      opacity: 0.6,
                      marginBottom: '8px'
                    }}
                  >
                    This application uses the Qobuz API but is not certified by Qobuz.
                  </p>
                </div>
              </aside>

              <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>

              <main className="main-content">
                <header className="top-bar">
                  <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button id="menu-toggle" className="btn secondary icon-btn" onClick={toggleSidebar}>
                      <Icons.Menu />
                    </button>
                    <h2 id="page-title">{getPageTitle(activeTab)}</h2>
                  </div>
                  <div className="header-right" style={{ display: 'flex', gap: '10px' }}>
                    <div className={`sync-pill ${connected ? 'online' : 'offline'}`}>
                      <span className="sync-dot" />
                      <span>{connected ? 'Synced' : 'Reconnecting'}</span>
                    </div>

                    {isDesktop && (
                      <div
                        className={`update-pill ${updateState?.status || 'idle'} ${updateState?.downloaded ? 'ready' : ''}`}
                        title={updateState?.message || 'Desktop updates'}
                      >
                        <span className="update-pill-label">{getUpdateLabel()}</span>
                        {updateState?.downloaded ? (
                          <button className="update-action-btn" onClick={handleInstallUpdate}>
                            Install
                          </button>
                        ) : (
                          <button
                            className="update-action-btn"
                            onClick={handleCheckUpdate}
                            disabled={isCheckingUpdate}
                          >
                            Check
                          </button>
                        )}
                      </div>
                    )}

                    <div style={{ position: 'relative' }}>
                      <button
                        className="btn secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowLangMenu(!showLangMenu);
                        }}
                        style={{
                          padding: '10px 16px',
                          fontSize: '14px',
                          minWidth: '85px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          height: '44px'
                        }}
                        title="Change Language"
                      >
                        {(() => {
                          const config = flags[language] || flags.en;
                          const Flag = config.icon;
                          return (
                            <>
                              <Flag width={18} height={18} />
                              <span>{config.label}</span>
                            </>
                          );
                        })()}
                      </button>

                      {showLangMenu && (
                        <div
                          className="dropdown-menu"
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 8px)',
                            right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            padding: '6px',
                            zIndex: 2000,
                            minWidth: '160px',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                          }}
                        >
                          {Object.entries(flags).map(([code, config]) => {
                            const FlagIcon = config.icon;
                            return (
                              <button
                                key={code}
                                onClick={() => {
                                  setLanguage(code as any);
                                  setShowLangMenu(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '10px 12px',
                                  width: '100%',
                                  border: 'none',
                                  background: language === code ? 'var(--bg-elevated)' : 'transparent',
                                  color: 'var(--text-primary)',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '13px',
                                  textAlign: 'left',
                                  transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'var(--bg-hover)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background =
                                    language === code ? 'var(--bg-elevated)' : 'transparent';
                                }}
                              >
                                <FlagIcon width={18} height={18} />
                                <span>{config.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      id="theme-toggle"
                      className="btn secondary"
                      title={t('common_toggle_theme')}
                      onClick={toggleTheme}
                      style={{
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '85px',
                        height: '44px'
                      }}
                    >
                      {theme === 'dark' ? (
                        <Icons.Moon width={20} height={20} />
                      ) : (
                        <Icons.Sun width={20} height={20} />
                      )}
                    </button>

                    <button
                      id="github-link"
                      className="btn secondary"
                      title="Open GitHub Project"
                      onClick={handleOpenGithub}
                      style={{
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '85px',
                        height: '44px'
                      }}
                    >
                      <Icons.Github width={20} height={20} />
                    </button>

                    <button id="add-btn" className="btn primary" onClick={() => setShowAddModal(true)}>
                      <span className="icon">
                        <Icons.Plus />
                      </span>{' '}
                      <span className="desktop-only">{t('action_add_url')}</span>
                    </button>
                  </div>
                </header>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                  >
                    {activeTab === 'queue' && <QueueView />}
                    {activeTab === 'search' && <SearchView />}
                    {activeTab === 'batch' && <BatchImportView />}
                    {activeTab === 'album' && <AlbumDetailView />}
                    {activeTab === 'artist' && <ArtistDetailView />}
                    {(activeTab === 'artist_albums' || activeTab === 'artist_tracks') && <ArtistListView />}

                    {activeTab === 'statistics' && <AnalyticsView />}
                    {activeTab === 'health' && <LibraryHealthView />}
                    {activeTab === 'library' && <LibraryView />}
                    {activeTab === 'playlists' && <PlaylistsView />}
                    {activeTab === 'history' && <HistoryView />}
                    {activeTab === 'logs' && <LogView />}
                    {activeTab === 'settings' && <SettingsView />}
                  </motion.div>
                </AnimatePresence>

                <Player sidebarCollapsed={sidebarCollapsed} />
              </main>
            </div>
          )}

          {showAddModal && <AddUrlModal onClose={() => setShowAddModal(false)} onSuccess={() => {}} />}

          {showLoginModal && (
            <LoginModal
              onSuccess={() => {
                setShowLoginModal(false);
                window.location.reload();
              }}
            />
          )}
          <QueuePanel />
        </DropZone>
      </ErrorBoundary>

    </div>
  );
}

function App() {
  return (
    <SocketProvider>
      <LanguageProvider>
        <NavigationProvider>
          <ThemeProvider>
            <ToastProvider>
              <PlayerProvider>
                <AppContent />
              </PlayerProvider>
            </ToastProvider>
          </ThemeProvider>
        </NavigationProvider>
      </LanguageProvider>
    </SocketProvider>
  );
}

export default App;
