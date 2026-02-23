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

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentTheme, setCurrentTheme] = useState<Theme>(defaultTheme);
    const [themes, setThemes] = useState<Theme[]>([]);
    const [dynamicColors, setDynamicColors] = useState<{ player: string | null, view: string | null }>({ player: null, view: null });

    useEffect(() => {
        fetchThemes();

        const savedThemeId = localStorage.getItem('activeThemeId');
        if (savedThemeId) {
        }
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
    }, [dynamicColors, currentTheme]);

    return (
        <ThemeContext.Provider value={{
            currentTheme,
            themes,
            setCurrentTheme,
            saveTheme,
            deleteTheme,
            applyTheme,
            resetTheme,
            setDynamicAccent
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
