import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';

export type Tab =
    | 'queue'
    | 'search'
    | 'batch'
    | 'statistics'
    | 'library'
    | 'playlists'
    | 'history'
    | 'settings'
    | 'logs'
    | 'metadata'
    | 'album'
    | 'artist'
    | 'artist_albums'
    | 'artist_tracks';

const ALLOWED_TABS: Tab[] = [
    'queue', 'search', 'batch', 'statistics', 'library', 'playlists', 'history', 'metadata', 'settings', 'logs'
];

const ALLOWED_ROUTES: string[] = [
    'queue', 'search', 'batch', 'statistics', 'library', 'playlists', 'history', 'metadata', 'settings', 'logs'
];

export interface SearchState {
    query: string;
    type: 'albums' | 'tracks' | 'artists';
    results: any[];
    total: number;
    page: number;
}

export interface NavigationData {
    id?: string;
    [key: string]: any;
}


interface NavigationContextType {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    navData: NavigationData | null;
    setNavData: (data: NavigationData | null) => void;
    navigate: (tab: Tab, data?: NavigationData) => void;
    searchState: SearchState;
    setSearchState: (state: SearchState | ((prev: SearchState) => SearchState)) => void;
}

const NavigationContext = createContext<NavigationContextType>({
    activeTab: 'queue',
    setActiveTab: () => { },
    navData: null,
    setNavData: () => { },
    navigate: () => { },
    searchState: { query: '', type: 'albums', results: [], total: 0, page: 0 },
    setSearchState: () => { }
});

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { settings, updateSetting, loading: settingsLoading } = useSettings();
    const [activeTab, setActiveTabState] = useState<Tab>('queue');
    const [navData, setNavData] = useState<NavigationData | null>(null);
    const [searchState, setSearchState] = useState<SearchState>({
        query: '',
        type: 'albums',
        results: [],
        total: 0,
        page: 0
    });

    useEffect(() => {
        const path = window.location.pathname;
        if (path === '/') {
            if (!settingsLoading) {
                const last = settings.UI_LAST_TAB as Tab;
                if (last && ALLOWED_TABS.includes(last)) {
                    setActiveTabState(last);
                }
            }
            return;
        }

        if (path.startsWith('/artist/')) {
            const id = path.split('/')[2];
            if (id) {
                setActiveTabState('artist');
                setNavData({ id });
            }
        } else if (path.startsWith('/album/')) {
            const id = path.split('/')[2];
            if (id) {
                setActiveTabState('album');
                setNavData({ id });
            }
        } else {
            const tab = path.substring(1) as Tab;
            if (ALLOWED_ROUTES.includes(tab)) {
                setActiveTabState(tab);
            }
        }
    }, [settingsLoading, settings.UI_LAST_TAB]);

    const updateUrl = (tab: Tab, data?: NavigationData | null) => {
        let path = '/';
        if (tab === 'artist' && data?.id) path = `/artist/${data.id}`;
        else if (tab === 'album' && data?.id) path = `/album/${data.id}`;
        else if (tab !== 'queue') {
            const route = ALLOWED_ROUTES.find(r => r === tab);
            if (route) path = `/${route}`;
        }

        if (window.location.pathname !== path) {
            window.history.pushState(null, '', path);
        }
    };

    const setActiveTab = (tab: Tab) => {
        setActiveTabState(tab);
        updateSetting('ui_last_tab', tab);
        if (!['artist', 'album', 'artist_albums', 'artist_tracks'].includes(tab)) {
            setNavData(null);
            updateUrl(tab, null);
        }
    };

    const navigate = (tab: Tab, data?: NavigationData) => {
        if (data) setNavData(data);
        setActiveTabStateUnchecked(tab);
        updateUrl(tab, data);
    };

    const setActiveTabStateUnchecked = (tab: Tab) => {
        setActiveTabState(tab);
        updateSetting('ui_last_tab', tab);
    }

    useEffect(() => {
        const handlePop = () => {
            const path = window.location.pathname;
            if (path.startsWith('/artist/')) {
                setActiveTabState('artist');
                setNavData({ id: path.split('/')[2] });
            } else if (path.startsWith('/album/')) {
                setActiveTabState('album');
                setNavData({ id: path.split('/')[2] });
            } else {
                const tab = path.substring(1) as Tab || 'queue';
                if (ALLOWED_TABS.includes(tab)) {
                    setActiveTabState(tab);
                    setNavData(null);
                }
            }
        };
        window.addEventListener('popstate', handlePop);
        return () => window.removeEventListener('popstate', handlePop);
    }, []);

    return (
        <NavigationContext.Provider value={{
            activeTab, setActiveTab,
            navData, setNavData, navigate,
            searchState, setSearchState
        }}>
            {children}
        </NavigationContext.Provider>
    );
};

export const useNavigation = () => useContext(NavigationContext);
