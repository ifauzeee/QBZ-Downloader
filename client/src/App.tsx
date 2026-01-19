import { useState, useEffect } from 'react';
import { SocketProvider } from './contexts/SocketContext';
import { NavigationProvider, useNavigation, type Tab } from './contexts/NavigationContext';
import { ToastProvider } from './contexts/ToastContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PlayerProvider } from './contexts/PlayerContext';
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
import { AddUrlModal, LoginModal } from './components/Modals';
import { Icons } from './components/Icons';
import { applyAccent } from './utils/theme';


function AppContent() {
  const { activeTab, setActiveTab } = useNavigation();
  const { t, language, setLanguage } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [showLangMenu, setShowLangMenu] = useState(false);

  useEffect(() => {
    document.body.className = `${theme}-theme`;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const accent = localStorage.getItem('accent') || '#6366f1';
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

  const toggleSidebar = () => {
    if (window.innerWidth <= 768) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };
  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const flags: Record<string, { icon: any, label: string, name: string }> = {
    en: { icon: Icons.FlagUS, label: 'EN', name: 'English' },
    id: { icon: Icons.FlagID, label: 'ID', name: 'Bahasa' },
    es: { icon: Icons.FlagES, label: 'ES', name: 'Español' },
    fr: { icon: Icons.FlagFR, label: 'FR', name: 'Français' },
    de: { icon: Icons.FlagDE, label: 'DE', name: 'Deutsch' },
    ja: { icon: Icons.FlagJA, label: 'JA', name: '日本語' },
    zh: { icon: Icons.FlagZH, label: 'ZH', name: '中文' }
  };

  const navItems: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: 'queue', icon: <Icons.Queue />, label: t('menu_queue') },
    { id: 'search', icon: <Icons.Search />, label: t('menu_search') },
    { id: 'batch', icon: <Icons.Batch />, label: t('menu_batch') },
    { id: 'statistics', icon: <Icons.Analytics />, label: t('menu_analytics') },
    { id: 'library', icon: <Icons.Library />, label: t('menu_library') },
    { id: 'playlists', icon: <Icons.Playlist />, label: t('menu_playlists') },
    { id: 'history', icon: <Icons.History />, label: t('menu_history') },
    { id: 'logs', icon: <Icons.Logs />, label: 'System Logs' },
    { id: 'settings', icon: <Icons.Settings />, label: t('menu_settings') },
  ];

  const getPageTitle = (tab: Tab) => {
    const titles: Record<string, string> = {
      queue: t('title_queue'),
      search: t('title_search'),
      batch: t('title_batch'),
      statistics: t('title_analytics'),
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

  return (
    <div className="app-container">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="logo">
          <span className="logo-icon">🎵</span>
          <h1 style={{ whiteSpace: 'nowrap' }}>QBZ-DL</h1>
        </div>
        <nav className="nav-menu">
          {navItems.map(item => (
            <a
              key={item.id}
              href="#"
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setActiveTab(item.id); setSidebarOpen(false); }}
              title={sidebarCollapsed ? item.label : ''}
            >
              <span className="icon">{item.icon}</span> <span className="nav-label">{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <p style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.6, marginBottom: '8px' }}>
            This application uses the Qobuz API but is not certified by Qobuz.
          </p>
        </div>
      </aside>

      <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>

      <main className="main-content">
        <header className="top-bar">
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <button id="menu-toggle" className="btn secondary icon-btn" onClick={toggleSidebar}>
              {sidebarCollapsed ? <Icons.Menu /> : <Icons.Menu />}
            </button>
            <h2 id="page-title">{getPageTitle(activeTab)}</h2>
          </div>
          <div className="header-right" style={{ display: 'flex', gap: '10px' }}>
            <div style={{ position: 'relative' }}>
              <button
                className="btn secondary"
                onClick={(e) => { e.stopPropagation(); setShowLangMenu(!showLangMenu); }}
                style={{ padding: '10px 16px', fontSize: '14px', minWidth: '85px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '44px' }}
                title="Change Language"
              >
                {(() => {
                  const config = flags[language] || flags['en'];
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
                <div className="dropdown-menu" style={{
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
                }}>
                  {Object.entries(flags).map(([code, config]) => {
                    const FlagIcon = config.icon;
                    return (
                      <button
                        key={code}
                        onClick={() => { setLanguage(code as any); setShowLangMenu(false); }}
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
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = language === code ? 'var(--bg-elevated)' : 'transparent'}
                      >
                        <FlagIcon width={18} height={18} />
                        <span>{config.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button id="theme-toggle" className="btn secondary" title={t('common_toggle_theme')} onClick={toggleTheme} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '85px', height: '44px' }}>
              {theme === 'dark' ? <Icons.Moon width={20} height={20} /> : <Icons.Sun width={20} height={20} />}
            </button>
            <button id="add-btn" className="btn primary" onClick={() => setShowAddModal(true)}>
              <span className="icon"><Icons.Plus /></span> <span className="desktop-only">{t('action_add_url')}</span>
            </button>
          </div>
        </header>

        {activeTab === 'queue' && <QueueView />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'batch' && <BatchImportView />}
        {activeTab === 'album' && <AlbumDetailView />}
        {activeTab === 'artist' && <ArtistDetailView />}
        {(activeTab === 'artist_albums' || activeTab === 'artist_tracks') && <ArtistListView />}

        {activeTab === 'statistics' && <AnalyticsView />}
        {activeTab === 'library' && <LibraryView />}
        {activeTab === 'playlists' && <PlaylistsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'logs' && <LogView />}
        {activeTab === 'settings' && <SettingsView />}

        <Player sidebarCollapsed={sidebarCollapsed} />
      </main>

      {showAddModal && (
        <AddUrlModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { }}
        />
      )}

      {showLoginModal && (
        <LoginModal
          onSuccess={() => {
            setShowLoginModal(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  )
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

export default App
