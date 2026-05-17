import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { smartFetch } from '../utils/api';

export interface Settings {
    [key: string]: any;
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    updateSetting: (key: string, value: any) => Promise<boolean>;
    updateSettings: (values: Record<string, any>) => Promise<boolean>;
    refreshSettings: () => Promise<void>;
    addToStaging: (url: string) => Promise<void>;
    clearStaging: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const normalizeSettingKeys = (values: Record<string, any>): Settings =>
    Object.entries(values).reduce<Settings>((normalized, [key, value]) => {
        normalized[key.toUpperCase()] = value;
        return normalized;
    }, {});

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);
    const settingsRef = useRef<Settings>({});

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    const refreshSettings = async () => {
        try {
            const res = await smartFetch('/api/settings');
            if (res && res.ok) {
                const data = await res.json();
                setSettings(data);
                settingsRef.current = data;
            }
        } catch (error) {
            console.error('Failed to fetch settings', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshSettings();
    }, []);

    const updateSetting = async (key: string, value: any) => {
        return updateSettings({ [key]: value });
    };

    const updateSettings = async (values: Record<string, any>) => {
        try {
            const res = await smartFetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: values })
            });

            if (res && res.ok) {
                const normalizedValues = normalizeSettingKeys(values);
                setSettings(prev => {
                    const next = { ...prev, ...normalizedValues };
                    settingsRef.current = next;
                    return next;
                });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update settings', error);
            return false;
        }
    };

    const addToStaging = async (url: string) => {
        const current = settingsRef.current.UI_BATCH_STAGING_URLS || '';
        const stagedUrls = current.split('\n').map((line: string) => line.trim()).filter(Boolean);
        if (stagedUrls.includes(url)) return;

        const separator = current ? '\n' : '';
        const updated = current + separator + url;
        settingsRef.current = {
            ...settingsRef.current,
            UI_BATCH_STAGING_URLS: updated
        };
        setSettings(prev => ({ ...prev, UI_BATCH_STAGING_URLS: updated }));
        await updateSetting('ui_batch_staging_urls', updated);
    };

    const clearStaging = async () => {
        await updateSetting('ui_batch_staging_urls', '');
    };

    return (
        <SettingsContext.Provider value={{ settings, loading, updateSetting, updateSettings, refreshSettings, addToStaging, clearStaging }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
