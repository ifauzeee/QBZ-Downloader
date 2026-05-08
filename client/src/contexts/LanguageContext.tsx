import React, { createContext, useContext, useState, type ReactNode } from 'react';

import en from '../locales/en.json';
import id from '../locales/id.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import de from '../locales/de.json';
import ja from '../locales/ja.json';
import zh from '../locales/zh.json';
import hi from '../locales/hi.json';
import tr from '../locales/tr.json';

export type Language = 'en' | 'id' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'hi' | 'tr';

const translations: Record<Language, any> = {
    en,
    id,
    es,
    fr,
    de,
    ja,
    zh,
    hi,
    tr
};

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = useState<Language>(
        (localStorage.getItem('language') as Language) || 'id'
    );

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('language', lang);
    };

    const t = (key: string): string => {
        const langData = translations[language] || translations.en;
        return langData[key] || translations.en[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
