import { describe, expect, it } from 'vitest';
import { I18nService, TranslationSet } from './i18n.js';

const english: TranslationSet = {
    appName: 'QBZ Downloader',
    loading: 'Loading...',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    confirm: 'Confirm',
    close: 'Close',
    search: 'Search',
    download: 'Download',
    settings: 'Settings',
    history: 'History',
    queue: 'Queue',
    statistics: 'Statistics',
    queueEmpty: 'Queue is empty',
    queuePause: 'Pause Queue',
    queueResume: 'Resume Queue',
    queueClear: 'Clear Queue',
    addToQueue: 'Add to Queue',
    pasteUrl: 'Paste Qobuz URL here...',
    downloading: 'Downloading',
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    downloadComplete: 'Download Complete',
    downloadFailed: 'Download Failed',
    downloadStarting: 'Starting download...',
    skipExisting: 'Skip existing files',
    credentials: 'Credentials',
    downloadPath: 'Download Path',
    quality: 'Quality',
    theme: 'Theme',
    language: 'Language',
    darkMode: 'Dark Mode',
    lightMode: 'Light Mode',
    invalidUrl: 'Invalid Qobuz URL',
    tokenExpired: 'Token expired, please update in settings',
    networkError: 'Network error, please try again',
    totalDownloads: 'Total Downloads',
    todayDownloads: 'Today',
    totalSize: 'Total Size',
    averagePerDay: 'Average/Day',
    notificationTitle: 'Notifications',
    markAllRead: 'Mark all as read',
    noNotifications: 'No notifications'
};

describe('I18nService', () => {
    it('should fall back to English when the active locale is missing a key', () => {
        const service = new I18nService({
            en: english,
            id: { save: 'Simpan', loading: '' },
            es: {},
            fr: {},
            de: {},
            ja: {},
            zh: {},
            hi: {}
        });

        service.setLocale('id');

        expect(service.t('save')).toBe('Simpan');
        expect(service.t('cancel')).toBe('Cancel');
        expect(service.t('loading')).toBe('Loading...');
    });

    it('should merge English fallbacks into full locale bundles', () => {
        const service = new I18nService({
            en: english,
            id: { save: 'Simpan' },
            es: {},
            fr: {},
            de: {},
            ja: {},
            zh: {},
            hi: {}
        });

        service.setLocale('id');
        const bundle = service.getAll();

        expect(bundle.save).toBe('Simpan');
        expect(bundle.cancel).toBe('Cancel');
    });
});
