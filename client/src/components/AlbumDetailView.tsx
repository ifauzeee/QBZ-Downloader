import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { useNavigation } from '../contexts/NavigationContext';
import { playTrack } from './Player';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './Icons';

interface Track {
    id: string;
    title: string;
    duration: number;
    track_number: number;
    parental_warning?: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    performer?: { name: string };
}

interface AlbumData {
    id: string;
    title: string;
    artist: { name: string };
    image: { large: string; medium: string; small: string };
    tracks: { items: Track[] };
    duration: number;
    track_count: number;
    genre?: { name: string };
    release_date_original?: string;
    label?: { name: string };
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    hires?: boolean;
}

export const AlbumDetailView: React.FC = () => {
    const { navData, setActiveTab } = useNavigation();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [album, setAlbum] = useState<AlbumData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState<'album' | 'lyrics'>('album');

    useEffect(() => {
        if (navData && navData.id) {
            fetchAlbum(navData.id);
        }
    }, [navData]);

    const fetchAlbum = async (id: string) => {
        setLoading(true);
        setError('');
        try {
            const res = await smartFetch(`/api/album/${id}`);
            if (res && res.ok) {
                const data = await res.json();
                setAlbum(data);
            } else {
                setError('Failed to load album');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const addToQueue = async (type: string, id: string) => {
        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id })
            });
            if (res && res.ok) {
                showToast(t('msg_added_to_queue') || 'Added to queue', 'success');
            } else {
                showToast('Failed to add', 'error');
            }
        } catch (e) {
            showToast('Failed to add', 'error');
        }
    };

    const addToBatchStaging = (type: string, id: string) => {
        const url = `https://open.qobuz.com/${type}/${id}`;
        const existing = localStorage.getItem('batch_staging_urls') || '';
        const separator = existing ? '\n' : '';
        localStorage.setItem('batch_staging_urls', existing + separator + url);
        showToast('Added to Batch Staging', 'success');
    };

    const openDownloadModal = (type: 'album' | 'lyrics') => {
        setModalType(type);
        setShowModal(true);
    };

    const confirmDownload = async (asZip: boolean) => {
        setShowModal(false);
        if (!album || !album.tracks || !album.tracks.items) return;

        if (modalType === 'album') {
            if (asZip) {
                const urls = album.tracks.items.map(t => `https://open.qobuz.com/track/${t.id}`);
                showToast(`Starting album ZIP download...`, 'info');
                try {
                    await smartFetch('/api/batch/import/direct', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls, createZip: true })
                    });
                    showToast('Album download started (ZIP)', 'success');
                } catch (e) {
                    showToast('Failed to start album download', 'error');
                }
            } else {
                addToQueue('album', album.id);
            }
        } else {
            if (asZip) {
                showToast(`Generating lyrics ZIP...`, 'info');
                try {
                    const res = await smartFetch('/api/lyrics/download-album-zip', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ albumId: album.id })
                    });
                    if (res && res.ok) {
                        const data = await res.json();
                        if (data.success && data.filePath) {
                            showToast(`Lyrics ZIP Saved: ${data.filePath.split(/[\\/]/).pop()}`, 'success');
                        } else {
                            showToast('Failed to create lyrics ZIP', 'error');
                        }
                    } else {
                        showToast('Failed to create lyrics ZIP', 'error');
                    }
                } catch (e) {
                    showToast('Failed to request lyrics ZIP', 'error');
                }
            } else {
                showToast(`Starting lyrics download for ${album.tracks.items.length} tracks...`, 'info');
                let successCount = 0;
                for (const track of album.tracks.items) {
                    try {
                        await smartFetch('/api/lyrics/download', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ trackId: track.id })
                        });
                        successCount++;
                    } catch (e) {
                        console.error(`Failed to trigger lyrics for ${track.id}`);
                    }
                }
                showToast(`Lyrics download finished.`, 'success');
            }
        }
    };

    const downloadTrackLyrics = async (trackId: string) => {
        try {
            await smartFetch('/api/lyrics/download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId })
            });
            showToast('Lyrics download queued', 'success');
        } catch (e) {
            showToast('Failed to start lyrics download', 'error');
        }
    };

    if (!navData || !navData.id) {
        return (
            <div id="view-album" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state">
                    <h3>No Album Selected</h3>
                    <button className="btn secondary" onClick={() => setActiveTab('search')}>Back to Search</button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div id="view-album" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state"><div className="spinner"></div><p>{t('common_loading')}</p></div>
            </div>
        );
    }

    if (error || !album) {
        return (
            <div id="view-album" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state">
                    <h3>Error</h3>
                    <p>{error || 'Album not found'}</p>
                    <button className="btn secondary" onClick={() => setActiveTab('search')}>Back to Search</button>
                </div>
            </div>
        );
    }

    const cover = (album.image?.large || album.image?.medium || '').replace('_642', '_600');
    const isHiRes = !!album.hires;
    const bitDepth = album.maximum_bit_depth || (isHiRes ? 24 : 16);
    const sampleRate = album.maximum_sampling_rate || 44.1;

    return (
        <div id="view-album" className="view-section" style={{ display: 'block' }}>
            <button className="btn secondary" onClick={() => setActiveTab('search')} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.ArrowLeft width={16} height={16} /> Back to Search
            </button>
            <div id="album-full-content">
                <div className="album-header">
                    <img src={cover} className="album-header-cover" alt={album.title} />
                    <div className="album-header-info">
                        <div className="album-header-title">
                            {album.title}
                            {isHiRes && <span className="hires-indicator">HI-RES {bitDepth}/{sampleRate}</span>}
                        </div>
                        <div className="album-header-artist">{album.artist?.name}</div>
                        <div className="album-header-meta">
                            {album.genre?.name} • {album.release_date_original} • {album.tracks?.items?.length} Tracks • {Math.floor(album.duration / 60)} mins
                            <br />
                            {album.label?.name}
                        </div>
                        <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                            <button className="btn primary" onClick={() => openDownloadModal('album')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Icons.Download width={16} height={16} /> {t('action_download')} Album
                            </button>
                            <button className="btn secondary" onClick={() => addToBatchStaging('album', album.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title={t('menu_batch')}>
                                <Icons.Batch width={16} height={16} />
                            </button>
                            <button className="btn secondary" onClick={() => openDownloadModal('lyrics')} style={{ display: 'flex', alignItems: 'center', gap: '6px' }} title="Download All Lyrics">
                                <Icons.Mic width={16} height={16} /> All Lyrics
                            </button>
                        </div>
                    </div>
                </div>

                <div className="track-list">
                    {album.tracks?.items?.map((track) => (
                        <div key={track.id} className="track-item">
                            <div className="track-number">{track.track_number}</div>
                            <div className="track-title">
                                {track.title}
                                {track.parental_warning && <span style={{ color: 'var(--danger)', fontSize: '10px', border: '1px solid var(--danger)', padding: '0 4px', borderRadius: '4px', marginLeft: '6px' }}>E</span>}
                            </div>
                            <div className="track-duration">
                                {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                            </div>
                            <div className="track-actions">
                                <button className="btn-track-dl" title={t('action_download')} onClick={() => addToQueue('track', track.id)}>
                                    <Icons.Download width={14} height={14} />
                                </button>
                                <button className="btn-track-dl" title={t('menu_batch')} onClick={() => addToBatchStaging('track', track.id)}>
                                    <Icons.Batch width={14} height={14} />
                                </button>
                                <button className="btn-track-dl" title="Download Lyrics" onClick={() => downloadTrackLyrics(track.id)}>
                                    <Icons.Mic width={14} height={14} />
                                </button>
                                <button className="btn-track-dl" title={t('action_play')} onClick={() => playTrack(track.id, track.title, track.performer?.name || album.artist.name, cover, album.id)}>
                                    <Icons.Play width={14} height={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {
                showModal && (
                    <div className="modal-overlay" style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                    }}>
                        <div className="modal-content" style={{
                            background: 'var(--bg-card)', padding: '24px', borderRadius: '12px',
                            maxWidth: '400px', width: '100%', border: '1px solid var(--border)'
                        }}>
                            <h3 style={{ marginTop: 0 }}>Download {modalType === 'album' ? 'Album' : 'All Lyrics'}</h3>
                            <p>How would you like to download {modalType === 'album' ? 'this album' : 'these lyrics'}?</p>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                                <button className="btn primary" onClick={() => confirmDownload(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px' }}>
                                    <Icons.Archive width={24} height={24} />
                                    <span>Download as ZIP</span>
                                </button>
                                <button className="btn secondary" onClick={() => confirmDownload(false)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '16px' }}>
                                    <Icons.List width={24} height={24} />
                                    <span>Separate Files</span>
                                </button>
                            </div>
                            <button onClick={() => setShowModal(false)} style={{ width: '100%', marginTop: '16px', padding: '8px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
