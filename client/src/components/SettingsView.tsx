import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmModal } from './Modals';
import { Icons } from './Icons';

interface AppSettings {
    DOWNLOADS_PATH: string;
    FOLDER_TEMPLATE: string;
    FILE_TEMPLATE: string;
    MAX_CONCURRENCY: number;
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
    const [creds, setCreds] = useState<Credentials | null>(null);
    const [validationResult, setValidationResult] = useState<any>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [form, setForm] = useState({ appId: '', appSecret: '', token: '', userId: '' });
    const { showToast } = useToast();

    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showDoubleConfirm, setShowDoubleConfirm] = useState(false);
    const [showDeleteThemeConfirm, setShowDeleteThemeConfirm] = useState<string | null>(null);

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
            if (sRes && sRes.ok) setSettings(await sRes.json());
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

            loadSettings();
        } catch (e) {
            setValidationError('Validation error');
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
            </div >

            <div className="settings-section">
                <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="icon"><Icons.Library /></span> {t('sec_config')}
                </h3>
                <p className="section-desc">{t('desc_config')}</p>
                <div className="current-settings-grid">
                    <div className="setting-display-item">
                        <span className="setting-label">{t('label_dl_path')}</span>
                        <span className="setting-value">{settings?.DOWNLOADS_PATH || '-'}</span>
                    </div>
                    <div className="setting-display-item">
                        <span className="setting-label">{t('label_folder_tmpl')}</span>
                        <span className="setting-value">{settings?.FOLDER_TEMPLATE || '-'}</span>
                    </div>
                    <div className="setting-display-item">
                        <span className="setting-label">{t('label_file_tmpl')}</span>
                        <span className="setting-value">{settings?.FILE_TEMPLATE || '-'}</span>
                    </div>
                    <div className="setting-display-item">
                        <span className="setting-label">{t('label_concurrency')}</span>
                        <span className="setting-value">{settings?.MAX_CONCURRENCY || '-'}</span>
                    </div>
                </div>
            </div>

            <div className="settings-section">
                <h3 className="section-title">
                    <span className="icon">🎨</span> {t('sec_appearance')}
                </h3>
                <div className="appearance-options">
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
        </div >
    );
};
