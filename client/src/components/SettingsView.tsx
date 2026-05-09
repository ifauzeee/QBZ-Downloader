import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmModal } from './Modals';
import { Icons } from './Icons';

interface AppSettings {
    QOBUZ_APP_ID: string;
    QOBUZ_APP_SECRET: string;
    QOBUZ_USER_AUTH_TOKEN: string;
    QOBUZ_USER_ID: string;
    DOWNLOADS_PATH: string;
    FOLDER_TEMPLATE: string;
    FILE_TEMPLATE: string;
    MAX_CONCURRENCY: number;
    DEFAULT_QUALITY: number | string;
    STREAMING_QUALITY: number;
    RETRY_ATTEMPTS: number;
    RETRY_DELAY: number;
    EMBED_COVER_ART: boolean;
    SAVE_COVER_FILE: boolean;
    COVER_SIZE: string;
    DOWNLOAD_LYRICS: boolean;
    EMBED_LYRICS: boolean;
    SAVE_LRC_FILE: boolean;
    LYRICS_TYPE: string;
    DASHBOARD_PORT: number;
    DASHBOARD_PASSWORD_CONFIGURED: boolean;
    AI_REPAIR_ENABLED: boolean;
    AI_PROVIDER: string;
    AI_API_KEY_CONFIGURED: boolean;
    AI_MODEL: string;
    MEDIA_SERVER_ENABLED: boolean;
    MEDIA_SERVER_TYPE: string;
    MEDIA_SERVER_URL: string;
    MEDIA_SERVER_TOKEN_CONFIGURED: boolean;
    MEDIA_SERVER_LIBRARY_ID: string;
    EXPORT_ENABLED: boolean;
    EXPORT_FORMAT: string;
    EXPORT_BITRATE: string;
    EXPORT_KEEP_ORIGINAL: boolean;
    EXPORT_PATH: string;
    BANDWIDTH_LIMIT: number;
    FFMPEG_AVAILABLE: boolean;
}

interface Credentials {
    configured: {
        appId: boolean;
        appSecret: boolean;
        token: boolean;
        userId: boolean;
    };
}

export const SettingsView: React.FC = () => {
    const { t } = useLanguage();
    const {
        themes,
        currentTheme,
        saveTheme,
        deleteTheme,
        applyTheme,
        resetTheme
    } = useTheme();

    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [settingsForm, setSettingsForm] = useState({
        downloadsPath: './downloads',
        folderTemplate: '{albumArtist}/{album}',
        fileTemplate: '{track_number}. {title}',
        maxConcurrency: 2,
        defaultQuality: '27',
        streamingQuality: 5,
        retryAttempts: 3,
        retryDelay: 1000,
        embedCoverArt: true,
        saveCoverFile: true,
        coverSize: 'max',
        downloadLyrics: true,
        embedLyrics: true,
        saveLrcFile: true,
        lyricsType: 'both',
        dashboardPort: 3000,
        dashboardPassword: '',
        aiRepairEnabled: false,
        aiProvider: 'none',
        aiApiKey: '',
        aiModel: 'gemini-1.5-flash',
        mediaServerEnabled: false,
        mediaServerType: 'none',
        mediaServerUrl: '',
        mediaServerToken: '',
        mediaServerLibraryId: '',
        exportEnabled: false,
        exportFormat: 'mp3',
        exportBitrate: '320k',
        exportKeepOriginal: true,
        exportPath: '',
        bandwidthLimit: 0
    });
    const [creds, setCreds] = useState<Credentials | null>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [form, setForm] = useState({ appId: '', appSecret: '', token: '', userId: '' });
    const { showToast } = useToast();

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDoubleConfirm, setShowDoubleConfirm] = useState(false);
    const [showDeleteThemeConfirm, setShowDeleteThemeConfirm] = useState<string | null>(null);

    const [msTestResult, setMsTestResult] = useState<string | null>(null);
    const [msTestError, setMsTestError] = useState<string | null>(null);
    const [msTesting, setMsTesting] = useState(false);

    const [isEditingTheme, setIsEditingTheme] = useState(false);
    const [themeName, setThemeName] = useState('');
    const [themeColors, setThemeColors] = useState<Record<string, string>>({});
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [sRes, cRes] = await Promise.all([
                smartFetch('/api/settings'),
                smartFetch('/api/credentials/status')
            ]);
            if (sRes && sRes.ok) {
                const data = await sRes.json();
                setSettings(data);
                setSettingsForm({
                    downloadsPath: data.DOWNLOADS_PATH || './downloads',
                    folderTemplate: data.FOLDER_TEMPLATE || '{albumArtist}/{album}',
                    fileTemplate: data.FILE_TEMPLATE || '{track_number}. {title}',
                    maxConcurrency: Number(data.MAX_CONCURRENCY || 2),
                    defaultQuality: String(data.DEFAULT_QUALITY ?? '27'),
                    streamingQuality: Number(data.STREAMING_QUALITY || 5),
                    retryAttempts: Number(data.RETRY_ATTEMPTS || 3),
                    retryDelay: Number(data.RETRY_DELAY || 1000),
                    embedCoverArt:
                        data.EMBED_COVER_ART !== undefined ? Boolean(data.EMBED_COVER_ART) : true,
                    saveCoverFile:
                        data.SAVE_COVER_FILE !== undefined ? Boolean(data.SAVE_COVER_FILE) : true,
                    coverSize: data.COVER_SIZE || 'max',
                    downloadLyrics:
                        data.DOWNLOAD_LYRICS !== undefined ? Boolean(data.DOWNLOAD_LYRICS) : true,
                    embedLyrics:
                        data.EMBED_LYRICS !== undefined ? Boolean(data.EMBED_LYRICS) : true,
                    saveLrcFile:
                        data.SAVE_LRC_FILE !== undefined ? Boolean(data.SAVE_LRC_FILE) : true,
                    lyricsType: data.LYRICS_TYPE || 'both',
                    dashboardPort: Number(data.DASHBOARD_PORT || 3000),
                    dashboardPassword: '',
                    aiRepairEnabled: Boolean(data.AI_REPAIR_ENABLED),
                    aiProvider: data.AI_PROVIDER || 'none',
                    aiApiKey: '',
                    aiModel: data.AI_MODEL || 'gemini-1.5-flash',
                    mediaServerEnabled: Boolean(data.MEDIA_SERVER_ENABLED),
                    mediaServerType: data.MEDIA_SERVER_TYPE || 'none',
                    mediaServerUrl: data.MEDIA_SERVER_URL || '',
                    mediaServerToken: '',
                    mediaServerLibraryId: data.MEDIA_SERVER_LIBRARY_ID || '',
                    exportEnabled: Boolean(data.EXPORT_ENABLED),
                    exportFormat: data.EXPORT_FORMAT || 'mp3',
                    exportBitrate: data.EXPORT_BITRATE || '320k',
                    exportKeepOriginal: data.EXPORT_KEEP_ORIGINAL !== undefined ? Boolean(data.EXPORT_KEEP_ORIGINAL) : true,
                    exportPath: data.EXPORT_PATH || '',
                    bandwidthLimit: Number(data.BANDWIDTH_LIMIT || 0)
                });
            }
            if (cRes && cRes.ok) setCreds(await cRes.json());
        } catch (e) { console.error(e); }
    };

    const updateCredentials = async () => {
        try {
            const res = await smartFetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    app_id: form.appId,
                    app_secret: form.appSecret,
                    token: form.token,
                    user_id: form.userId
                })
            });

            if (res && res.ok) {
                const data = await res.json();
                if (data.success) {
                    showToast(data.message || 'Updated!', 'success');
                    setForm({ appId: '', appSecret: '', token: '', userId: '' });
                    loadSettings();
                } else {
                    showToast(data.error || 'Update failed', 'error');
                }
            } else if (res) {
                const data = await res.json();
                showToast(data.error || 'Update failed', 'error');
            } else {
                showToast('Connection failed', 'error');
            }
        } catch (e) {
            showToast('Error', 'error');
        }
    };

    const updateAppSettings = async () => {
        try {
            const payload: Record<string, any> = {
                downloads_path: settingsForm.downloadsPath,
                folder_template: settingsForm.folderTemplate,
                file_template: settingsForm.fileTemplate,
                max_concurrency: settingsForm.maxConcurrency,
                default_quality: settingsForm.defaultQuality,
                streaming_quality: settingsForm.streamingQuality,
                retry_attempts: settingsForm.retryAttempts,
                retry_delay: settingsForm.retryDelay,
                embed_cover_art: settingsForm.embedCoverArt,
                save_cover_file: settingsForm.saveCoverFile,
                cover_size: settingsForm.coverSize,
                download_lyrics: settingsForm.downloadLyrics,
                embed_lyrics: settingsForm.embedLyrics,
                save_lrc_file: settingsForm.saveLrcFile,
                lyrics_type: settingsForm.lyricsType,
                dashboard_port: settingsForm.dashboardPort,
                ai_repair_enabled: settingsForm.aiRepairEnabled,
                ai_provider: settingsForm.aiProvider,
                ai_model: settingsForm.aiModel,
                media_server_enabled: settingsForm.mediaServerEnabled,
                media_server_type: settingsForm.mediaServerType,
                media_server_url: settingsForm.mediaServerUrl,
                media_server_library_id: settingsForm.mediaServerLibraryId,
                export_enabled: settingsForm.exportEnabled,
                export_format: settingsForm.exportFormat,
                export_bitrate: settingsForm.exportBitrate,
                export_keep_original: settingsForm.exportKeepOriginal,
                export_path: settingsForm.exportPath,
                bandwidth_limit: settingsForm.bandwidthLimit
            };

            if (settingsForm.dashboardPassword.trim()) {
                payload.dashboard_password = settingsForm.dashboardPassword.trim();
            }

            if (settingsForm.aiApiKey.trim()) {
                payload.ai_api_key = settingsForm.aiApiKey.trim();
            }

            if (settingsForm.mediaServerToken.trim()) {
                payload.media_server_token = settingsForm.mediaServerToken.trim();
            }

            const res = await smartFetch('/api/settings/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res && res.ok) {
                showToast('Settings saved', 'success');
                await loadSettings();
                return;
            }

            if (res) {
                const err = await res.json();
                showToast(err.error || 'Failed to save settings', 'error');
            } else {
                showToast('Connection failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to save settings', 'error');
        }
    };

    const testMediaServer = async () => {
        if (!settingsForm.mediaServerUrl) {
            showToast('Media Server URL is required', 'error');
            return;
        }

        try {
            setMsTesting(true);
            setMsTestResult(null);
            setMsTestError(null);
            
            const res = await smartFetch('/api/media-server/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: settingsForm.mediaServerType,
                    url: settingsForm.mediaServerUrl,
                    token: settingsForm.mediaServerToken,
                    libraryId: settingsForm.mediaServerLibraryId
                })
            });

            if (res && res.ok) {
                const data = await res.json();
                setMsTestResult(data.message);
                showToast(data.message, 'success');
            } else {
                const err = res ? await res.json() : { error: 'Network error' };
                setMsTestError(err.error || 'Connection failed');
                showToast(err.error || 'Connection failed', 'error');
            }
        } catch (error: any) {
            setMsTestError(error.message);
            showToast(error.message, 'error');
        } finally {
            setMsTesting(false);
        }
    };

    const validateCredentials = async () => {
        try {
            showToast('Validating...', 'info');
            setValidationResult(null);
            setValidationError(null);
            const res = await smartFetch('/api/login', { method: 'POST' });

            if (res) {
                const data = await res.json();
                if (res.ok) {
                    if (data.success && data.user) {
                        setValidationResult(data.user);
                        showToast('Credentials valid', 'success');
                    } else {
                        setValidationError('Login failed');
                    }
                } else {
                    setValidationError(data.error || 'Validation failed');
                }
            } else {
                setValidationError('Network error or server unreachable');
            }
        } catch (error: any) {
            setValidationError(error.message);
            showToast('Validation failed', 'error');
        }
    };

    const triggerReset = () => {
        setShowResetConfirm(true);
    };

    const handleResetConfirm = () => {
        setShowResetConfirm(false);
        setShowDoubleConfirm(true);
    };

    const handleDoubleConfirm = async () => {
        try {
            const res = await smartFetch('/api/system/reset', { method: 'POST' });
            if (res && res.ok) {
                showToast('System reset successfully', 'success');
                setTimeout(() => window.location.reload(), 1500);
            } else {
                showToast('Reset failed', 'error');
            }
        } catch (e) { showToast('Error', 'error'); }
        setShowDoubleConfirm(false);
    };

    const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const themeId = e.target.value;
        if (themeId === 'default') {
            resetTheme();
            return;
        }

        const selectedTheme = themes.find(t => t.id === themeId);
        if (selectedTheme) {
            applyTheme(selectedTheme);
        }
    };

    const startEditingTheme = () => {
        setIsEditingTheme(true);
        setThemeName('New Theme');
        setThemeColors({ ...currentTheme.colors });
        setIsDarkTheme(currentTheme.is_dark);
    };

    const saveCurrentTheme = async () => {
        if (!themeName.trim()) {
            showToast('Theme name is required', 'error');
            return;
        }
        await saveTheme(themeName, isDarkTheme, themeColors);
        setIsEditingTheme(false);
        showToast('Theme saved', 'success');
    };

    const updateColor = (key: string, value: string) => {
        const newColors = { ...themeColors, [key]: value };
        setThemeColors(newColors);
        document.documentElement.style.setProperty(key, value);
    };

    return (
        <div id="view-settings" className="view-section active">
            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">🔐</span> {t('sec_creds')}
                </h3>
                <div className="cred-status-grid">
                    <div className="cred-status-item">
                        <span className="cred-label">App ID</span>
                        <span className={`cred-value ${creds?.configured.appId ? 'valid' : 'invalid'}`}>
                            {creds?.configured.appId ? '✓ Configured' : '✗ Missing'}
                        </span>
                    </div>
                    <div className="cred-status-item">
                        <span className="cred-label">App Secret</span>
                        <span className={`cred-value ${creds?.configured.appSecret ? 'valid' : 'invalid'}`}>
                            {creds?.configured.appSecret ? '✓ Configured' : '✗ Missing'}
                        </span>
                    </div>
                    <div className="cred-status-item">
                        <span className="cred-label">Auth Token</span>
                        <span className={`cred-value ${creds?.configured.token ? 'valid' : 'invalid'}`}>
                            {creds?.configured.token ? '✓ Configured' : '✗ Missing'}
                        </span>
                    </div>
                    <div className="cred-status-item">
                        <span className="cred-label">User ID</span>
                        <span className={`cred-value ${creds?.configured.userId ? 'valid' : 'invalid'}`}>
                            {creds?.configured.userId ? '✓ Configured' : '✗ Missing'}
                        </span>
                    </div>
                </div>
                <div className="cred-actions">
                    <button className="btn primary" onClick={validateCredentials} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icons.Resolve width={14} height={14} /> {t('action_validate')}
                    </button>
                    {validationError && (
                        <div style={{
                            marginTop: '15px',
                            padding: '12px',
                            background: 'rgba(220, 53, 69, 0.1)',
                            borderRadius: '6px',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '0.9em',
                            width: '100%'
                        }}>
                            <span>⚠️</span> {validationError}
                        </div>
                    )}
                </div>
                {validationResult && (
                    <div style={{ marginTop: '15px', padding: '15px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>✓</span> Validation Successful
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 15px', fontSize: '0.9em' }}>
                            <div style={{ opacity: 0.7 }}>Account:</div>
                            <div>{validationResult.email} ({validationResult.country_code})</div>

                            {validationResult.subscription && (
                                <>
                                    <div style={{ opacity: 0.7 }}>Subscription:</div>
                                    <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>{validationResult.subscription.offer}</div>

                                    {(validationResult.subscription.end_date || validationResult.subscription.period_end_date) && (
                                        <>
                                            <div style={{ opacity: 0.7 }}>Expires:</div>
                                            <div>{validationResult.subscription.end_date || validationResult.subscription.period_end_date}</div>
                                        </>
                                    )}
                                </>
                            )}

                            <div style={{ opacity: 0.7 }}>Hi-Res Streaming:</div>
                            <div>
                                {validationResult.hires_streaming ||
                                    validationResult.credential?.parameters?.hires_streaming ||
                                    (validationResult.subscription?.offer &&
                                        (validationResult.subscription.offer.includes('Studio') ||
                                            validationResult.subscription.offer.includes('Sublime')))
                                    ? 'Yes'
                                    : 'No'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon"><Icons.Batch /></span> {t('sec_update_creds')}
                </h3>
                <p className="section-desc">{t('desc_update_creds')}</p>
                <div className="update-cred-grid">
                    <div className="form-group">
                        <label>App ID</label>
                        <input type="text" placeholder="Enter new App ID..." value={form.appId} onChange={e => setForm({ ...form, appId: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>App Secret</label>
                        <input type="text" placeholder="Enter new Secret..." value={form.appSecret} onChange={e => setForm({ ...form, appSecret: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Auth Token</label>
                        <input type="text" placeholder="Enter new Token..." value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>User ID</label>
                        <input type="text" placeholder="Enter new User ID..." value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} />
                    </div>
                </div>
                <button className="btn primary" onClick={updateCredentials} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icons.Download width={14} height={14} /> {t('action_update_creds')}
                </button>
            </div>

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon"><Icons.Library /></span> {t('sec_config')}
                </h3>
                <p className="section-desc">{t('desc_config')}</p>
                <div className="update-cred-grid">
                    <div className="form-group">
                        <label>{t('label_dl_path')}</label>
                        <input
                            type="text"
                            value={settingsForm.downloadsPath}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, downloadsPath: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_folder_tmpl')}</label>
                        <input
                            type="text"
                            value={settingsForm.folderTemplate}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, folderTemplate: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_file_tmpl')}</label>
                        <input
                            type="text"
                            value={settingsForm.fileTemplate}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, fileTemplate: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_concurrency')}</label>
                        <input
                            type="number"
                            min={1}
                            max={10}
                            value={settingsForm.maxConcurrency}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    maxConcurrency: Number(e.target.value || 1)
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_default_quality')}</label>
                        <select
                            value={settingsForm.defaultQuality}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, defaultQuality: e.target.value }))
                            }
                        >
                            <option value="5">MP3 320</option>
                            <option value="6">FLAC 16/44.1</option>
                            <option value="7">FLAC 24/96</option>
                            <option value="27">FLAC 24/192</option>
                            <option value="ask">Ask Every Time</option>
                            <option value="min">Minimum</option>
                            <option value="max">Maximum</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_streaming_quality')}</label>
                        <select
                            value={settingsForm.streamingQuality}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    streamingQuality: Number(e.target.value)
                                }))
                            }
                        >
                            <option value={5}>MP3 320</option>
                            <option value={6}>FLAC 16/44.1</option>
                            <option value={7}>FLAC 24/96</option>
                            <option value={27}>FLAC 24/192</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_retry_attempts')}</label>
                        <input
                            type="number"
                            min={0}
                            max={10}
                            value={settingsForm.retryAttempts}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    retryAttempts: Number(e.target.value || 0)
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_retry_delay')}</label>
                        <input
                            type="number"
                            min={0}
                            value={settingsForm.retryDelay}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    retryDelay: Number(e.target.value || 0)
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_cover_size')}</label>
                        <select
                            value={settingsForm.coverSize}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, coverSize: e.target.value }))
                            }
                        >
                            <option value="small">Small</option>
                            <option value="large">Large</option>
                            <option value="max">Max</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_lyrics_type')}</label>
                        <select
                            value={settingsForm.lyricsType}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, lyricsType: e.target.value }))
                            }
                        >
                            <option value="synced">Synced</option>
                            <option value="plain">Plain</option>
                            <option value="both">Both</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_dashboard_port')}</label>
                        <input
                            type="number"
                            min={1}
                            max={65535}
                            value={settingsForm.dashboardPort}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    dashboardPort: Number(e.target.value || 3000)
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_dashboard_password')}</label>
                        <input
                            type="text"
                            placeholder={
                                settings?.DASHBOARD_PASSWORD_CONFIGURED
                                    ? 'Configured (leave blank to keep current password)'
                                    : 'Leave empty for public dashboard'
                            }
                            value={settingsForm.dashboardPassword}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    dashboardPassword: e.target.value
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_bandwidth_limit')}</label>
                        <input
                            type="number"
                            min={0}
                            placeholder={t('desc_bandwidth_limit')}
                            value={settingsForm.bandwidthLimit}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    bandwidthLimit: Number(e.target.value || 0)
                                }))
                            }
                        />
                    </div>
                    <div className="settings-checkbox-group">
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, embedCoverArt: !prev.embedCoverArt }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.embedCoverArt}
                                onChange={() => { }} // Controlled by parent div click
                            />
                            <label>{t('label_embed_cover')}</label>
                        </div>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, saveCoverFile: !prev.saveCoverFile }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.saveCoverFile}
                                onChange={() => { }}
                            />
                            <label>{t('label_save_cover')}</label>
                        </div>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, downloadLyrics: !prev.downloadLyrics }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.downloadLyrics}
                                onChange={() => { }}
                            />
                            <label>{t('label_download_lyrics')}</label>
                        </div>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, embedLyrics: !prev.embedLyrics }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.embedLyrics}
                                onChange={() => { }}
                            />
                            <label>{t('label_embed_lyrics')}</label>
                        </div>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, saveLrcFile: !prev.saveLrcFile }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.saveLrcFile}
                                onChange={() => { }}
                            />
                            <label>{t('label_save_lrc')}</label>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '32px' }}>
                    <button className="btn primary hero" onClick={updateAppSettings} style={{ minHeight: '52px', padding: '0 40px' }}>
                        {t('action_save_settings')}
                    </button>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">🤖</span> {t('sec_ai_metadata')}
                </h3>
                <p className="section-desc">{t('desc_ai_metadata')}</p>
                <div className="update-cred-grid">
                    <div className="form-group">
                        <label>{t('label_ai_provider')}</label>
                        <select
                            value={settingsForm.aiProvider}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, aiProvider: e.target.value }))
                            }
                        >
                            <option value="none">None</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_ai_model')}</label>
                        <input
                            type="text"
                            placeholder={
                                settingsForm.aiProvider === 'gemini' 
                                    ? 'e.g. gemini-1.5-flash' 
                                    : 'e.g. gpt-4o'
                            }
                            value={settingsForm.aiModel}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, aiModel: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>{t('label_ai_api_key')}</label>
                        <input
                            type="password"
                            placeholder={
                                settings?.AI_API_KEY_CONFIGURED
                                    ? 'Configured (leave blank to keep current key)'
                                    : 'Enter API Key...'
                            }
                            value={settingsForm.aiApiKey}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    aiApiKey: e.target.value
                                }))
                            }
                        />
                    </div>
                    <div className="settings-checkbox-group" style={{ gridColumn: 'span 2' }}>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, aiRepairEnabled: !prev.aiRepairEnabled }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.aiRepairEnabled}
                                onChange={() => { }}
                            />
                            <label>{t('label_ai_enabled')}</label>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '32px' }}>
                    <button className="btn primary hero" onClick={updateAppSettings} style={{ minHeight: '52px', padding: '0 40px' }}>
                        {t('action_save_settings')}
                    </button>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">🖥️</span> {t('sec_media_server')}
                </h3>
                <p className="section-desc">{t('desc_media_server')}</p>
                <div className="update-cred-grid">
                    <div className="form-group">
                        <label>{t('label_ms_type')}</label>
                        <select
                            value={settingsForm.mediaServerType}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, mediaServerType: e.target.value }))
                            }
                        >
                            <option value="none">None</option>
                            <option value="plex">Plex</option>
                            <option value="jellyfin">Jellyfin</option>
                            <option value="webhook">Webhook</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_ms_url')}</label>
                        <input
                            type="text"
                            placeholder="e.g. http://192.168.1.100:32400"
                            value={settingsForm.mediaServerUrl}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, mediaServerUrl: e.target.value }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_ms_token')}</label>
                        <input
                            type="password"
                            placeholder={
                                settings?.MEDIA_SERVER_TOKEN_CONFIGURED
                                    ? 'Configured (leave blank to keep current)'
                                    : 'Enter API Token...'
                            }
                            value={settingsForm.mediaServerToken}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({
                                    ...prev,
                                    mediaServerToken: e.target.value
                                }))
                            }
                        />
                    </div>
                    <div className="form-group">
                        <label>{t('label_ms_library')}</label>
                        <input
                            type="text"
                            placeholder="e.g. 1"
                            value={settingsForm.mediaServerLibraryId}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, mediaServerLibraryId: e.target.value }))
                            }
                        />
                    </div>
                    <div className="settings-checkbox-group" style={{ gridColumn: 'span 2' }}>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, mediaServerEnabled: !prev.mediaServerEnabled }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.mediaServerEnabled}
                                onChange={() => { }}
                            />
                            <label>{t('label_ms_enabled')}</label>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '24px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button 
                        className={`btn ${msTesting ? 'secondary' : 'primary'}`} 
                        onClick={testMediaServer} 
                        disabled={msTesting || settingsForm.mediaServerType === 'none'}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {msTesting ? <Icons.Loading width={14} height={14} className="spin" /> : <Icons.Resolve width={14} height={14} />}
                        {msTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                    {msTestResult && <span style={{ color: 'var(--success)', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '4px' }}>✓ {msTestResult}</span>}
                    {msTestError && <span style={{ color: 'var(--danger)', fontSize: '0.9em', display: 'flex', alignItems: 'center', gap: '4px' }}>✗ {msTestError}</span>}
                </div>
                <div style={{ marginTop: '32px' }}>
                    <button className="btn primary hero" onClick={updateAppSettings} style={{ minHeight: '52px', padding: '0 40px' }}>
                        {t('action_save_settings')}
                    </button>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">🔄</span> {t('sec_export')}
                </h3>
                <p className="section-desc">{t('desc_export')}</p>
                
                <div style={{ 
                    marginBottom: '24px', 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    background: settings?.FFMPEG_AVAILABLE ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--danger-rgb), 0.1)',
                    border: `1px solid ${settings?.FFMPEG_AVAILABLE ? 'var(--success)' : 'var(--danger)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9em'
                }}>
                    <span style={{ fontSize: '1.2em' }}>{settings?.FFMPEG_AVAILABLE ? '✅' : '❌'}</span>
                    <span style={{ color: settings?.FFMPEG_AVAILABLE ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {settings?.FFMPEG_AVAILABLE ? t('msg_ffmpeg_found') : t('msg_ffmpeg_missing')}
                    </span>
                </div>

                <div className="update-cred-grid">
                    <div className="form-group">
                        <label>{t('label_export_format')}</label>
                        <select
                            value={settingsForm.exportFormat}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, exportFormat: e.target.value }))
                            }
                        >
                            <option value="mp3">MP3</option>
                            <option value="aac">AAC (M4A)</option>
                            <option value="opus">Opus</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>{t('label_export_bitrate')}</label>
                        <select
                            value={settingsForm.exportBitrate}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, exportBitrate: e.target.value }))
                            }
                        >
                            <option value="128k">128 kbps</option>
                            <option value="192k">192 kbps</option>
                            <option value="256k">256 kbps</option>
                            <option value="320k">320 kbps</option>
                        </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>{t('label_export_path')}</label>
                        <input
                            type="text"
                            placeholder="Leave empty to save in same folder as FLAC"
                            value={settingsForm.exportPath}
                            onChange={(e) =>
                                setSettingsForm((prev) => ({ ...prev, exportPath: e.target.value }))
                            }
                        />
                    </div>
                    <div className="settings-checkbox-group" style={{ gridColumn: 'span 2' }}>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, exportEnabled: !prev.exportEnabled }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.exportEnabled}
                                onChange={() => { }}
                                disabled={!settings?.FFMPEG_AVAILABLE}
                            />
                            <label style={{ opacity: settings?.FFMPEG_AVAILABLE ? 1 : 0.5 }}>{t('label_export_enabled')}</label>
                        </div>
                        <div className="settings-checkbox-item" onClick={() => setSettingsForm(prev => ({ ...prev, exportKeepOriginal: !prev.exportKeepOriginal }))}>
                            <input
                                type="checkbox"
                                checked={settingsForm.exportKeepOriginal}
                                onChange={() => { }}
                            />
                            <label>{t('label_export_keep')}</label>
                        </div>
                    </div>
                </div>
                <div style={{ marginTop: '32px' }}>
                    <button className="btn primary hero" onClick={updateAppSettings} style={{ minHeight: '52px', padding: '0 40px' }}>
                        {t('action_save_settings')}
                    </button>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="section-title">
                    <span className="icon">🎨</span> {t('sec_appearance')}
                </h3>

                <div className="form-group">
                    <label>{t('label_theme')}</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <select id="theme-select" value={currentTheme.id} onChange={handleThemeChange} style={{ flex: 1 }}>
                            <option value="default">{t('default_theme') || 'Default Dark'}</option>
                            {themes.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <button className="btn primary" onClick={startEditingTheme} title="Create Custom Theme">
                            <Icons.Plus width={16} height={16} />
                        </button>
                        {currentTheme.id !== 'default' && (
                            <button
                                className="btn danger"
                                onClick={() => setShowDeleteThemeConfirm(currentTheme.id)}
                                title="Delete Theme"
                            >
                                <Icons.Trash width={16} height={16} />
                            </button>
                        )}
                    </div>
                </div>

                {isEditingTheme && (
                    <div className="theme-editor" style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: 'var(--bg-elevated)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)'
                    }}>
                        <h4>Create Custom Theme</h4>
                        <div className="form-group">
                            <label>Theme Name</label>
                            <input
                                type="text"
                                value={themeName}
                                onChange={(e) => setThemeName(e.target.value)}
                                placeholder="My Cool Theme"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label>Base Mode</label>
                            <div style={{ display: 'flex', gap: '15px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={isDarkTheme}
                                        onChange={() => setIsDarkTheme(true)}
                                    /> Dark
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                    <input
                                        type="radio"
                                        checked={!isDarkTheme}
                                        onChange={() => setIsDarkTheme(false)}
                                    /> Light
                                </label>
                            </div>
                        </div>

                        <div className="color-section">
                            <label style={{ marginBottom: '10px', display: 'block' }}>Colors</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                {[
                                    { key: '--bg-dark', label: 'Background' },
                                    { key: '--bg-card', label: 'Card Background' },
                                    { key: '--text-primary', label: 'Primary Text' },
                                    { key: '--accent-rgb', label: 'Accent Color', isRgb: true }
                                ].map(item => (
                                    <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input
                                            type="color"
                                            value={
                                                item.isRgb
                                                    ? (() => {
                                                        const rgb = themeColors[item.key] || '99, 102, 241';
                                                        const [r, g, b] = rgb.split(',').map(s => parseInt(s.trim()));
                                                        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                                                    })()
                                                    : (themeColors[item.key] || '#000000')
                                            }
                                            onChange={(e) => {
                                                let val = e.target.value;
                                                if (item.isRgb) {
                                                    const r = parseInt(val.slice(1, 3), 16);
                                                    const g = parseInt(val.slice(3, 5), 16);
                                                    const b = parseInt(val.slice(5, 7), 16);
                                                    val = `${r}, ${g}, ${b}`;
                                                }
                                                updateColor(item.key, val);
                                            }}
                                            style={{ width: '30px', height: '30px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '13px' }}>{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <button className="btn secondary" onClick={() => {
                                setIsEditingTheme(false);
                                applyTheme(currentTheme);
                            }}>Cancel</button>
                            <button className="btn primary" onClick={saveCurrentTheme}>Save Theme</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="settings-section" style={{ border: '1px solid var(--danger)', background: 'rgba(220, 53, 69, 0.05)' }}>
                <h3 className="section-title" style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon">⚠️</span> {t('sec_danger')}
                </h3>
                <p className="section-desc">{t('desc_danger')}</p>
                <div className="danger-actions">
                    <button className="btn danger" onClick={triggerReset} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icons.Trash width={14} height={14} /> {t('action_reset_full')}
                    </button>
                </div>
            </div>

            <ConfirmModal
                isOpen={showResetConfirm}
                title="FACTORY RESET WARNING ⚠️"
                message="This will permanently delete all download history, current queue, and statistics. This action cannot be undone. Are you sure?"
                confirmText={t('action_reset_full')}
                cancelText="Cancel"
                onConfirm={handleResetConfirm}
                onCancel={() => setShowResetConfirm(false)}
            />

            <ConfirmModal
                isOpen={showDoubleConfirm}
                title="Final Confirmation"
                message="Are you absolutely sure you want to wipe all data?"
                confirmText="Yes, Wipe Data"
                cancelText="No, Go Back"
                onConfirm={handleDoubleConfirm}
                onCancel={() => setShowDoubleConfirm(false)}
            />

            <ConfirmModal
                isOpen={!!showDeleteThemeConfirm}
                title="Delete Theme"
                message="Are you sure you want to delete this theme? This cannot be undone."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => {
                    if (showDeleteThemeConfirm) {
                        deleteTheme(showDeleteThemeConfirm);
                        setShowDeleteThemeConfirm(null);
                    }
                }}
                onCancel={() => setShowDeleteThemeConfirm(null)}
            />
        </div>
    );
};
