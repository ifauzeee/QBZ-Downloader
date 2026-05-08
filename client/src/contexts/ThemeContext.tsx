import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Theme {
    id: string;
    name: string;
    is_dark: boolean;
    colors: Record<string, string>;
    created_at?: string;
}

interface ThemeContextType {
    currentTheme: Theme;
    themes: Theme[];
    setCurrentTheme: (theme: Theme) => void;
    saveTheme: (name: string, isDark: boolean, colors: Record<string, string>) => Promise<void>;
    deleteTheme: (id: string) => Promise<void>;
    applyTheme: (theme: Theme) => void;
    resetTheme: () => void;
    setDynamicAccent: (colorRgb: string | null, source?: 'player' | 'view') => void;
    dynamicMode: boolean;
    setDynamicMode: (enabled: boolean) => void;
    followSystem: boolean;
    setFollowSystem: (enabled: boolean) => void;
}

const defaultTheme: Theme = {
    id: 'default',
    name: 'Default Dark',
    is_dark: true,
    colors: {
        '--bg-dark': '#000000',
        '--bg-card': '#0c0c0c',
        '--bg-hover': '#161616',
        '--bg-elevated': '#101010',
        '--text-primary': '#ffffff',
        '--text-secondary': '#aaaaaa',
        '--accent-rgb': '99, 102, 241',
        '--border': '#222222',
        '--border-light': '#333333'
    }
};

const defaultLightTheme: Theme = {
    id: 'default-light',
    name: 'Default Light',
    is_dark: false,
    colors: {
        '--bg-dark': '#f8fafc',
        '--bg-card': '#ffffff',
        '--bg-hover': '#f1f5f9',
        '--bg-elevated': '#fdfdfd',
        '--text-primary': '#0f172a',
        '--text-secondary': '#64748b',
        '--accent-rgb': '99, 102, 241',
        '--border': '#e2e8f0',
        '--border-light': '#f1f5f9'
    }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
    const [themes, setThemes] = useState<Theme[]>([]);
    const [dynamicColors, setDynamicColors] = useState<{ player: string | null, view: string | null }>({ player: null, view: null });
    const [dynamicMode, setDynamicMode] = useState(localStorage.getItem('dynamicTheme') === 'true');
    const [followSystem, setFollowSystem] = useState(localStorage.getItem('followSystemTheme') === 'true');

    useEffect(() => {
        localStorage.setItem('dynamicTheme', String(dynamicMode));
    }, [dynamicMode]);

    useEffect(() => {
        localStorage.setItem('followSystemTheme', String(followSystem));
        if (followSystem && window.qbzDesktop) {
            window.qbzDesktop.getSystemTheme().then((theme: 'dark' | 'light') => {
                handleSystemThemeChange(theme);
            });
        }
    }, [followSystem]);

    const handleSystemThemeChange = (theme: 'dark' | 'light') => {
        if (!followSystem) return;
        
        // Find a suitable theme for the current system mode
        // If it's dark, we use the default dark. If it's light, we look for a light theme.
        if (theme === 'dark') {
            applyTheme(defaultTheme);
        } else {
            // Find first light theme or fallback to a generated light theme
            const lightTheme = themes.find(t => !t.is_dark) || defaultLightTheme;
            applyTheme(lightTheme);
        }
    };

    useEffect(() => {
        if (window.qbzDesktop) {
            const cleanup = window.qbzDesktop.onSystemThemeChanged((theme: 'dark' | 'light') => {
                if (followSystem) {
                    handleSystemThemeChange(theme);
                }
            });
            return cleanup;
        }
    }, [followSystem, themes]);

    useEffect(() => {
        fetchThemes();
    }, []);

    const fetchThemes = async () => {
        try {
            const res = await fetch('/api/themes');
            const data = await res.json();
            if (Array.isArray(data)) {
                setThemes(data);
                const savedThemeId = localStorage.getItem('activeThemeId');
                if (savedThemeId) {
                    const found = data.find((t: Theme) => t.id === savedThemeId);
                    if (found) {
                        applyTheme(found);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load themes', error);
        }
    };

    const applyTheme = (theme: Theme) => {
        const root = document.documentElement;

        Object.entries(theme.colors).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });

        if (theme.colors['--accent-rgb']) {
            root.style.setProperty('--accent', `rgb(${theme.colors['--accent-rgb']})`);
            root.style.setProperty('--accent-hover', `rgba(${theme.colors['--accent-rgb']}, 0.8)`);
            root.style.setProperty('--accent-glow', `rgba(${theme.colors['--accent-rgb']}, 0.3)`);
        }

        if (theme.is_dark) {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }

        setCurrentTheme(theme);
        if (theme.id !== 'default') {
            localStorage.setItem('activeThemeId', theme.id);
        } else {
            localStorage.removeItem('activeThemeId');
        }
    };

    const saveTheme = async (name: string, isDark: boolean, colors: Record<string, string>) => {
        try {
            const res = await fetch('/api/themes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, isDark, colors })
            });
            const newTheme = await res.json();
            setThemes(prev => [...prev, newTheme]);
            applyTheme(newTheme);
        } catch (error) {
            console.error('Failed to save theme', error);
        }
    };

    const deleteTheme = async (id: string) => {
        try {
            await fetch(`/api/themes/${id}`, { method: 'DELETE' });
            setThemes(prev => prev.filter(t => t.id !== id));
            if (currentTheme.id === id) {
                resetTheme();
            }
        } catch (error) {
            console.error('Failed to delete theme', error);
        }
    };

    const resetTheme = () => {
        applyTheme(defaultTheme);
    };

    const setDynamicAccent = (colorRgb: string | null, source: 'player' | 'view' = 'view') => {
        setDynamicColors(prev => ({ ...prev, [source]: colorRgb }));
    };

    useEffect(() => {
        const root = document.documentElement;
        const targetColor = dynamicColors.player || dynamicColors.view || currentTheme.colors['--accent-rgb'] || defaultTheme.colors['--accent-rgb'];

        root.style.setProperty('--accent-rgb', targetColor);
        root.style.setProperty('--accent', `rgb(${targetColor})`);
        root.style.setProperty('--accent-hover', `rgba(${targetColor}, 0.8)`);
        root.style.setProperty('--accent-glow', `rgba(${targetColor}, 0.3)`);

        if (dynamicMode && dynamicColors.player) {
            root.style.setProperty('--bg-dynamic', `radial-gradient(circle at 100% 100%, rgba(${targetColor}, 0.15) 0%, var(--bg-dark) 100%)`);
            document.body.classList.add('dynamic-theme-active');
        } else {
            root.style.setProperty('--bg-dynamic', 'none');
            document.body.classList.remove('dynamic-theme-active');
        }
    }, [dynamicColors, currentTheme, dynamicMode]);

    return (
        <ThemeContext.Provider value={{
            currentTheme,
            themes,
            setCurrentTheme,
            saveTheme,
            deleteTheme,
            applyTheme,
            resetTheme,
            setDynamicAccent,
            dynamicMode,
            setDynamicMode,
            followSystem,
            setFollowSystem
        }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
