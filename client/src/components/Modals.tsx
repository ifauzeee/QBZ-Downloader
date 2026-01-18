import React, { useState } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';

interface AddUrlModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const AddUrlModal: React.FC<AddUrlModalProps> = ({ onClose, onSuccess }) => {
    const [url, setUrl] = useState('');
    const [quality, setQuality] = useState('27');
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, quality: Number(quality) })
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

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/status', {
                headers: { 'x-password': password }
            });

            if (res.ok) {
                localStorage.setItem('dashboard_password', password);
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
        <div className="modal" style={{ display: 'flex', background: 'rgba(0,0,0,0.9)', zIndex: 9999 }}>
            <div className="modal-content" style={{ maxWidth: '400px' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>🔐 Login Required</h2>
                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>Dashboard Password</label>
                        <input
                            type="password"
                            placeholder="Enter password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoFocus
                        />
                    </div>
                    {error && <div style={{ color: 'var(--danger)', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
                    <button type="submit" className="btn primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Verifying...' : 'Unlock Dashboard'}
                    </button>
                </form>
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
