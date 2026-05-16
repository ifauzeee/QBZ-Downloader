import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<Settings>({});
    const [loading, setLoading] = useState(true);

    const refreshSettings = async () => {
        try {
            const res = await smartFetch('/api/settings');
            if (res && res.ok) {
                const data = await res.json();
                setSettings(data);
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
                setSettings(prev => ({ ...prev, ...values }));
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to update settings', error);
            return false;
        }
    };

    const addToStaging = async (url: string) => {
        const current = settings.UI_BATCH_STAGING_URLS || '';
        const separator = current ? '\n' : '';
        const updated = current + separator + url;
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
