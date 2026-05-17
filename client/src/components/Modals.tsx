import React, { useState, useEffect, useRef } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { sha256 } from '../utils/crypto';
import { useSettings } from '../contexts/SettingsContext';

interface AddUrlModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const AddUrlModal: React.FC<AddUrlModalProps> = ({ onClose, onSuccess }) => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('27');
    const { showToast } = useToast();
    const { addToStaging } = useSettings();
    const [loading, setLoading] = useState(false);

    const parseQobuzTarget = (rawUrl: string): { type: string; id: string; url: string } | null => {
        const cleaned = rawUrl.trim().replace(/[),.;]+$/, '');
        if (!cleaned) return null;

        try {
            const parsed = new URL(cleaned);
            if (!parsed.hostname.toLowerCase().includes('qobuz.com')) return null;

            const segments = parsed.pathname.split('/').filter(Boolean);
            const typeIndex = segments.findIndex((segment) =>
                ['track', 'album', 'artist', 'interpreter', 'playlist'].includes(segment.toLowerCase())
            );
            if (typeIndex === -1 || typeIndex === segments.length - 1) return null;

            const rawType = segments[typeIndex].toLowerCase();
            const type = rawType === 'interpreter' ? 'artist' : rawType;
            const id = segments[segments.length - 1];
            if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return null;

            return { type, id, url: cleaned };
        } catch {
            return null;
        }
    };

    const extractQobuzTargets = (value: string) => {
        const urlMatches = value.match(/https?:\/\/[^\s]+/g);
        const candidates = urlMatches || value.split(/\r?\n/);
        const targets = candidates
            .map(parseQobuzTarget)
            .filter((target): target is { type: string; id: string; url: string } => Boolean(target));

        return targets.filter(
            (target, index, list) => list.findIndex((item) => item.url === target.url) === index
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const targets = extractQobuzTargets(url);
            if (targets.length === 0) {
                showToast('No valid Qobuz URLs found', 'error');
                return;
            }

            if (targets.length > 1) {
                for (const target of targets) {
                    await addToStaging(target.url);
                }
                showToast(`${targets.length} URLs added to Batch Import`, 'success');
                onSuccess();
                onClose();
                return;
            }

            const [target] = targets;
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: target.type, id: target.id, quality: Number(quality) })
            });

            if (res && res.ok) {
                showToast('Added to queue', 'success');
                onSuccess();
                onClose();
            } else {
                const data = await res?.json();
                showToast(data?.error || 'Failed to add', 'error');
            }
        } catch (error) {
            showToast('Network error', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal" style={{ display: 'flex' }}>
            <div className="modal-content">
                <span className="close" onClick={onClose}>&times;</span>
                <h2>Add Download</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Qobuz URL</label>
                        <input
                            type="text"
                            placeholder="https://play.qobuz.com/album/..."
                            required
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Quality</label>
                        <select value={quality} onChange={(e) => setQuality(e.target.value)}>
                            <option value="27">Hi-Res 24/192 (Default)</option>
                            <option value="7">Hi-Res 24/96</option>
                            <option value="6">CD Quality (16/44.1)</option>
                            <option value="5">MP3 320kbps</option>
                        </select>
                    </div>
                    <div className="form-actions">
                        <button type="submit" className="btn primary" disabled={loading}>
                            {loading ? 'Adding...' : 'Add to Queue'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface LoginModalProps {
    onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/auth/verify', {
                headers: { 'x-password': password }
            });

            if (res.ok) {
                const hash = await sha256(password);
                sessionStorage.setItem('dashboard_password', hash);
                onSuccess();
            } else {
                setError('Invalid password');
            }
        } catch (err) {
            setError('Connection failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal amoled-login-overlay" style={{ display: 'flex', zIndex: 9999 }}>
            <div className="amoled-login-card">
                <div className="login-side-info">
                    <div className="login-brand">
                        <span className="brand-icon">QBZ</span>
                        <span className="brand-name">QBZ-DL</span>
                    </div>
                    <div className="security-badge">
                        <span className="badge-icon">LOCK</span>
                        <h3>Access Restricted</h3>
                    </div>
                    <p className="login-desc">
                        Dashboard is currently locked for security. Please provide your administrative password to proceed and manage your high-res audio library.
                    </p>
                    <div className="login-footer-meta">
                        <span>v5.2.0</span>

                        <span className="dot"></span>
                        <span>This application uses the Qobuz API but is not certified by Qobuz.</span>
                    </div>
                </div>

                <div className="login-side-form">
                    <div className="form-header">
                        <h2>Unlock Dashboard</h2>
                        <p>Welcome back, Admin</p>
                    </div>

                    <form onSubmit={handleLogin} className="amoled-form">
                        <div className="amoled-input-group">
                            <label>Passphrase</label>
                            <input
                                ref={inputRef}
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={error ? 'input-error' : ''}
                            />
                            {error && <span className="error-text">Invalid password</span>}
                        </div>

                        <button
                            type="submit"
                            className="btn-amoled-primary"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="spinner-amoled"></div>
                            ) : (
                                <>
                                    <span>Unlock Now</span>
                                    <span className="btn-arrow">-&gt;</span>
                                </>
                            )}
                        </button>
                    </form>

                    <p style={{
                        fontSize: '9px',
                        color: '#333',
                        textAlign: 'center',
                        marginTop: '20px',
                        lineHeight: '1.4'
                    }}>
                        By unlocking, you agree to the <a href="http://static.qobuz.com/apps/api/QobuzAPI-TermsofUse.pdf" target="_blank" style={{ color: '#666' }}>Qobuz API Terms of Use</a>.
                    </p>
                </div>
            </div>
        </div>
    );
};

export interface ConfirmModalProps {
    isOpen?: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen = true,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal" style={{ display: 'flex', zIndex: 10000 }}>
            <div className="modal-content small-modal">
                <h2>{title}</h2>
                <p>{message}</p>
                <div className="modal-actions-grid">
                    <button className="btn secondary" onClick={onCancel}>
                        {cancelText}
                    </button>
                    <button className="btn danger" onClick={onConfirm}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};
