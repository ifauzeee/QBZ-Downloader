import React, { useEffect, useState } from 'react';
import { smartFetch, getQualityLabel } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmModal } from './Modals';
import { Icons } from './Icons';

interface Playlist {
    id: string;
    playlistId: string;
    title: string;
    quality: number;
    intervalHours: number;
    lastSyncedAt: string;
}

export const PlaylistsView: React.FC = () => {
    const { t } = useLanguage();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const [pid, setPid] = useState('');
    const [pQuality, setPQuality] = useState('27');
    const [pInterval, setPInterval] = useState('24');

    const { showToast } = useToast();

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/playlists/watched');
            if (res && res.ok) {
                const data = await res.json();
                setPlaylists(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const confirmStopTracking = (id: string) => {
        setSelectedId(id);
        setShowConfirm(true);
    };

    const handleStopTracking = async () => {
        if (!selectedId) return;
        try {
            const res = await smartFetch(`/api/playlists/watch/${selectedId}`, { method: 'DELETE' });
            if (res && res.ok) {
                showToast('Playlist removed', 'success');
                fetchPlaylists();
            } else {
                showToast('Failed to remove', 'error');
            }
        } catch (e) {
            showToast('Error', 'error');
        } finally {
            setShowConfirm(false);
            setSelectedId(null);
        }
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();

        let id = pid;
        if (id.includes('qobuz.com')) {
            const match = id.match(/playlist\/([a-zA-Z0-9]+)/);
            if (match) id = match[1];
        }

        try {
            const res = await smartFetch('/api/playlists/watch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playlistId: id, quality: Number(pQuality), intervalHours: Number(pInterval) })
            });

            if (res && res.ok) {
                showToast('Playlist tracked successfully', 'success');
                setShowAddModal(false);
                setPid('');
                fetchPlaylists();
            } else if (res) {
                const d = await res.json();
                showToast(d.error || 'Failed to add', 'error');
            } else {
                showToast('Connection error', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    };

    return (
        <div id="view-playlists" className="view-section active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>{t('title_playlists')}</h3>
                <button id="add-playlist-btn" className="btn primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icons.Plus width={16} height={16} /> Track New Playlist
                </button>
            </div>

            <div className="list-container">
                <div className="list-header" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                    <div>Title</div>
                    <div>Quality</div>
                    <div>Interval (Hrs)</div>
                    <div>Last Sync</div>
                    <div>Action</div>
                </div>

                <div id="playlists-list" className="list-body">
                    {!loading && playlists.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon"><Icons.Playlist width={48} height={48} /></div>
                            <h3>No Watched Playlists</h3>
                            <p>Track playlists to automatically download new songs</p>
                        </div>
                    )}

                    {playlists.map(p => (
                        <div key={p.id} className="list-row" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr' }}>
                            <div style={{ fontWeight: 600 }}>{p.title || p.playlistId}</div>
                            <div>{getQualityLabel(p.quality)}</div>
                            <div>{p.intervalHours}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{p.lastSyncedAt ? new Date(p.lastSyncedAt).toLocaleString() : 'Never'}</div>
                            <div>
                                <button className="btn danger" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => confirmStopTracking(p.id)}>
                                    <Icons.Trash width={12} height={12} /> {t('action_delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {showAddModal && (
                <div id="add-playlist-modal" className="modal" style={{ display: 'block' }}>
                    <div className="modal-content">
                        <span className="close" onClick={() => setShowAddModal(false)}>&times;</span>
                        <h2>Track Playlist</h2>
                        <form onSubmit={handleAdd}>
                            <div className="form-group">
                                <label>Playlist URL or ID</label>
                                <input type="text" placeholder="https://open.qobuz.com/playlist/..." value={pid} onChange={e => setPid(e.target.value)} required />
                            </div>
                            <div className="form-group">
                                <label>Quality</label>
                                <select value={pQuality} onChange={e => setPQuality(e.target.value)}>
                                    <option value="27">Hi-Res 24/192</option>
                                    <option value="7">Hi-Res 24/96</option>
                                    <option value="6">CD Quality (16/44.1)</option>
                                    <option value="5">MP3 320kbps</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Sync Interval (Hours)</label>
                                <input type="number" min="1" value={pInterval} onChange={e => setPInterval(e.target.value)} required />
                            </div>
                            <div className="form-actions">
                                <button type="submit" className="btn primary">Start Tracking</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirm}
                title="Stop Tracking Playlist?"
                message="Are you sure you want to stop tracking this playlist? It will no longer sync automatically."
                onConfirm={handleStopTracking}
                onCancel={() => setShowConfirm(false)}
            />
        </div>
    );
};
