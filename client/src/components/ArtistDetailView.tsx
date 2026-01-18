import React, { useEffect, useState } from 'react';
import { smartFetch } from '../utils/api';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playTrack } from './Player';
import { Icons } from './Icons';

interface ArtistData {
    id: string;
    name: string;
    image: { large: string; medium: string; small: string };
    biography?: { en?: string; id?: string;[key: string]: string | undefined } | string;
    albums?: { items: any[] };
    tracks?: { items: any[] };
    similar_artists?: { items: any[] };
    already_downloaded?: boolean;
}

export const ArtistDetailView: React.FC = () => {
    const { navData, setActiveTab, navigate } = useNavigation();
    const { t } = useLanguage();
    const { showToast } = useToast();
    const [artist, setArtist] = useState<ArtistData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [showFullBio, setShowFullBio] = useState(false);
    const [viewModeTracks, setViewModeTracks] = useState<'list' | 'grid'>('list');
    const [viewModeAlbums, setViewModeAlbums] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        if (navData && navData.id) {
            fetchArtist(navData.id);
        }
    }, [navData]);

    const fetchArtist = async (id: string) => {
        setLoading(true);
        setError('');
        setArtist(null);

        try {
            const res = await smartFetch(`/api/artist/${id}?limit=20`);
            if (res && res.ok) {
                const data = await res.json();
                setArtist(data);
            } else {
                setError('Failed to load artist');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const addToQueue = async (type: string, id: string | number) => {
        if (!id) {
            showToast('Invalid content ID', 'error');
            return;
        }
        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, id: String(id), quality: 27 })
            });
            if (res && res.ok) {
                showToast(t('msg_added_to_queue') || 'Added to queue', 'success');
            } else {
                showToast('Failed to add to queue', 'error');
            }
        } catch (e) {
            showToast('Network error', 'error');
        }
    };

    const addToBatchStaging = (type: string, id: string) => {
        const url = `https://open.qobuz.com/${type}/${id}`;
        const existing = localStorage.getItem('batch_staging_urls') || '';
        const separator = existing ? '\n' : '';
        localStorage.setItem('batch_staging_urls', existing + separator + url);
        showToast('Added to Batch Staging', 'success');
    };

    const downloadLyrics = async (trackId: string) => {
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

    if (!navData?.id) {
        return (
            <div id="view-artist" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state">No artist selected</div>
                <button className="btn secondary" onClick={() => setActiveTab('search')}>Back to Search</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div id="view-artist" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state"><div className="spinner"></div><p>{t('common_loading')}</p></div>
            </div>
        );
    }

    if (error || !artist) {
        return (
            <div id="view-artist" className="view-section" style={{ display: 'block' }}>
                <div className="empty-state">
                    <h3>Error</h3>
                    <p>{error || 'Artist not found'}</p>
                    <button className="btn secondary" onClick={() => setActiveTab('search')}>Back to Search</button>
                </div>
            </div>
        );
    }


    const cover = artist.image?.large || artist.image?.medium || artist.image?.small || '';
    const getBio = (bioData: any) => {
        if (!bioData) return '';
        if (typeof bioData === 'string') return bioData;
        return bioData.en || bioData.id || Object.values(bioData)[0] || '';
    };
    const bio = getBio(artist.biography);
    const isBioLong = bio.length > 300;
    const bioToDisplay = !isBioLong || showFullBio ? bio : bio.slice(0, 300) + '...';

    return (
        <div id="view-artist" className="view-section" style={{ display: 'block', paddingBottom: '100px' }}>
            <button className="btn secondary" onClick={() => setActiveTab('search')} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icons.ArrowLeft width={16} height={16} /> Back
            </button>

            <div className="artist-header" style={{ display: 'flex', gap: '24px', marginBottom: '40px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flexShrink: 0 }}>
                    {cover ?
                        <img src={cover} style={{ width: 220, height: 220, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 220, height: 220, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icons.Playlist width={64} height={64} style={{ opacity: 0.3 }} /></div>
                    }
                </div>
                <div style={{ flex: 1, minWidth: '300px' }}>
                    <h1 style={{ fontSize: '36px', marginBottom: '16px', fontWeight: 700 }}>{artist.name}</h1>
                    {bio && (
                        <div className="artist-bio" style={{ fontSize: '15px', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-line' }}>
                            {bioToDisplay}
                            {isBioLong && (
                                <div style={{ marginTop: '8px' }}>
                                    <span
                                        onClick={() => setShowFullBio(!showFullBio)}
                                        style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer', fontSize: '14px' }}
                                    >
                                        {showFullBio ? 'Read less' : 'Read more'}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {artist.tracks?.items && artist.tracks.items.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                        <h2 style={{ fontSize: '24px', margin: 0 }}>Tracks</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div className="view-toggle" style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '2px' }}>
                                <button
                                    onClick={() => setViewModeTracks('list')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: viewModeTracks === 'list' ? 'var(--accent)' : 'transparent',
                                        color: viewModeTracks === 'list' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="List View"
                                >
                                    <Icons.List width={14} height={14} />
                                </button>
                                <button
                                    onClick={() => setViewModeTracks('grid')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: viewModeTracks === 'grid' ? 'var(--accent)' : 'transparent',
                                        color: viewModeTracks === 'grid' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Grid View"
                                >
                                    <Icons.Grid width={14} height={14} />
                                </button>
                            </div>
                            <button className="btn secondary" onClick={() => navigate('artist_tracks', { id: artist.id })} style={{ padding: '6px 12px', fontSize: '13px' }}>View All</button>
                        </div>
                    </div>
                    <div className={viewModeTracks === 'list' ? 'track-list' : 'track-grid'}>
                        {artist.tracks.items.map((track, idx) => {
                            const resStr = track.maximum_bit_depth && track.maximum_sampling_rate
                                ? `${track.maximum_bit_depth}-Bit/${track.maximum_sampling_rate} kHz`
                                : '';
                            const albumImage = track.album?.image?.medium || track.album?.image?.small || track.album?.image?.thumbnail || '';

                            if (viewModeTracks === 'grid') {
                                return (
                                    <div key={track.id} className="track-card-grid">
                                        <div className="card-image">
                                            <img src={albumImage} loading="lazy" />
                                            <div className="card-overlay">
                                                <button onClick={() => playTrack(track.id, track.title, artist.name, cover, track.album?.id)} className="play-btn">
                                                    <Icons.Play width={20} height={20} fill="currentColor" />
                                                </button>
                                            </div>
                                            {resStr && <span className="res-badge">{resStr}</span>}
                                            {track.already_downloaded && (
                                                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--success)', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Downloaded</div>
                                            )}
                                        </div>
                                        <div className="card-info">
                                            <div className="card-title" title={track.title}>{track.title}</div>
                                            <div className="card-subtitle" title={track.album?.title}>{track.album?.title}</div>
                                            <div className="card-actions">
                                                <button
                                                    className="btn-icon-tiny"
                                                    onClick={() => !track.already_downloaded && addToQueue('track', track.id)}
                                                    title={track.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                                    disabled={track.already_downloaded}
                                                    style={track.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--success)', color: '#fff', borderColor: 'transparent' } : {}}
                                                >
                                                    {track.already_downloaded ? <Icons.Check width={12} height={12} /> : <Icons.Download width={12} height={12} />}
                                                </button>
                                                <button className="btn-icon-tiny" onClick={() => addToBatchStaging('track', track.id)} title={t('menu_batch')}><Icons.Batch width={12} height={12} /></button>
                                                <button className="btn-icon-tiny" onClick={() => downloadLyrics(track.id)} title="Download Lyrics"><Icons.Mic width={12} height={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={track.id} className="track-item" style={{ alignItems: 'center' }}>
                                    <span style={{ width: '30px', textAlign: 'center', color: 'var(--text-secondary)', opacity: 0.7, marginRight: '12px' }}>{idx + 1}</span>
                                    {/* List Item Content */}

                                    {albumImage && (
                                        <img src={albumImage} style={{ width: '48px', height: '48px', borderRadius: '4px', marginRight: '16px', objectFit: 'cover' }} loading="lazy" />
                                    )}

                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                        <div className="track-title" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {track.album?.title}
                                        </div>
                                        {resStr && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                                <span style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: '3px' }}>{resStr}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="track-duration" style={{ marginRight: '16px', fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                                        {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')}
                                    </div>
                                    <div className="track-actions">
                                        {track.already_downloaded && (
                                            <span style={{ fontSize: '10px', color: 'var(--success)', marginRight: '8px', fontWeight: 'bold' }}>DOWNLOADED</span>
                                        )}
                                        <button
                                            className={`btn-track-dl ${track.already_downloaded ? 'disabled' : ''}`}
                                            onClick={() => !track.already_downloaded && addToQueue('track', track.id)}
                                            title={track.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                            disabled={track.already_downloaded}
                                            style={track.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        >
                                            <Icons.Download width={14} height={14} />
                                        </button>
                                        <button className="btn-track-dl" onClick={() => addToBatchStaging('track', track.id)} title={t('menu_batch')}><Icons.Batch width={14} height={14} /></button>
                                        <button className="btn-track-dl" onClick={() => downloadLyrics(track.id)} title="Download Lyrics"><Icons.Mic width={14} height={14} /></button>
                                        <button className="btn-track-dl" onClick={() => playTrack(track.id, track.title, artist.name, cover, track.album?.id)} title={t('action_play')}><Icons.Play width={14} height={14} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {artist.albums?.items && artist.albums.items.length > 0 && (
                <div style={{ marginBottom: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                        <h2 style={{ fontSize: '24px', margin: 0 }}>Albums</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div className="view-toggle" style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: '6px', padding: '2px' }}>
                                <button
                                    onClick={() => setViewModeAlbums('list')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: viewModeAlbums === 'list' ? 'var(--accent)' : 'transparent',
                                        color: viewModeAlbums === 'list' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="List View"
                                >
                                    <Icons.List width={14} height={14} />
                                </button>
                                <button
                                    onClick={() => setViewModeAlbums('grid')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        background: viewModeAlbums === 'grid' ? 'var(--accent)' : 'transparent',
                                        color: viewModeAlbums === 'grid' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                    title="Grid View"
                                >
                                    <Icons.Grid width={14} height={14} />
                                </button>
                            </div>
                            <button className="btn secondary" onClick={() => navigate('artist_albums', { id: artist.id })} style={{ padding: '6px 12px', fontSize: '13px' }}>View All</button>
                        </div>
                    </div>
                    <div className={viewModeAlbums === 'list' ? 'track-list' : 'track-grid'}>
                        {artist.albums.items.map(album => {
                            const dateStr = album.release_date_original
                                ? new Date(album.release_date_original).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                : '';
                            const resStr = album.maximum_bit_depth && album.maximum_sampling_rate
                                ? `${album.maximum_bit_depth}-Bit/${album.maximum_sampling_rate} kHz`
                                : '';

                            if (viewModeAlbums === 'grid') {
                                return (
                                    <div key={album.id} className="track-card-grid" onClick={() => navigate('album', { id: album.id })}>
                                        <div className="card-image">
                                            <img src={album.image?.medium || album.image?.large || album.image?.small || ''} loading="lazy" />
                                            <div className="card-overlay">
                                                <button onClick={(e) => { e.stopPropagation(); if (!album.already_downloaded) addToQueue('album', album.id); }} className="play-btn" disabled={album.already_downloaded} style={album.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--success)' } : {}}>
                                                    {album.already_downloaded ? <Icons.Check width={24} height={24} /> : <Icons.Download width={20} height={20} />}
                                                </button>
                                            </div>
                                            {resStr && <span className="res-badge">{resStr}</span>}
                                            {album.already_downloaded && (
                                                <div style={{ position: 'absolute', top: 6, right: 6, background: 'var(--success)', color: '#fff', fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>Downloaded</div>
                                            )}
                                        </div>
                                        <div className="card-info">
                                            <div className="card-title" title={album.title}>{album.title}</div>
                                            <div className="card-subtitle">{dateStr}</div>
                                            <div className="card-actions">
                                                <button
                                                    className="btn-icon-tiny"
                                                    onClick={(e) => { e.stopPropagation(); if (!album.already_downloaded) addToQueue('album', album.id); }}
                                                    title={album.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                                    disabled={album.already_downloaded}
                                                    style={album.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--success)', color: '#fff', borderColor: 'transparent' } : {}}
                                                >
                                                    {album.already_downloaded ? <Icons.Check width={12} height={12} /> : <Icons.Download width={12} height={12} />}
                                                </button>
                                                <button className="btn-icon-tiny" onClick={(e) => { e.stopPropagation(); addToBatchStaging('album', album.id); }} title={t('menu_batch')}><Icons.Batch width={12} height={12} /></button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            return (
                                <div key={album.id} className="track-item" onClick={() => navigate('album', { id: album.id })} style={{ cursor: 'pointer', alignItems: 'flex-start' }}>
                                    <img src={album.image?.small || album.image?.thumbnail || ''} style={{ width: '60px', height: '60px', borderRadius: '4px', marginRight: '16px', objectFit: 'cover' }} loading="lazy" />
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                        <div style={{ fontWeight: '600', fontSize: '15px' }}>{album.title}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {album.genre?.name ? `${album.genre.name} • ` : ''}
                                            {album.label?.name ? `Released by ${album.label.name} on ` : ''}
                                            {dateStr}
                                        </div>
                                        {resStr && (
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '4px' }}>{resStr}</span>
                                                <span style={{ opacity: 0.7 }}>Stereo</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="track-actions" style={{ alignSelf: 'center' }}>
                                        {album.already_downloaded && (
                                            <span style={{ fontSize: '10px', color: 'var(--success)', marginRight: '8px', fontWeight: 'bold' }}>DOWNLOADED</span>
                                        )}
                                        <button
                                            className={`btn-track-dl ${album.already_downloaded ? 'disabled' : ''}`}
                                            onClick={(e) => { e.stopPropagation(); if (!album.already_downloaded) addToQueue('album', album.id); }}
                                            title={album.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                            disabled={album.already_downloaded}
                                            style={album.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                        >
                                            <Icons.Download width={14} height={14} />
                                        </button>
                                        <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); addToBatchStaging('album', album.id); }} title={t('menu_batch')}><Icons.Batch width={14} height={14} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {artist.similar_artists?.items && artist.similar_artists.items.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                    <h2 style={{ marginBottom: '20px', fontSize: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>Similar Artists</h2>
                    <div className="track-list">
                        {artist.similar_artists.items.map(sim => (
                            <div key={sim.id} className="track-item" onClick={() => navigate('artist', { id: sim.id })} style={{ cursor: 'pointer' }}>
                                <img src={sim.image?.small || sim.image?.thumbnail || ''} style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '16px', objectFit: 'cover' }} loading="lazy" />
                                <div style={{ flex: 1, fontWeight: '500' }}>{sim.name}</div>
                                <div className="track-actions">
                                    <button className="btn-track-dl" style={{ fontSize: '12px', padding: '4px 12px' }}>View</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = `
    .track-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 20px;
    }

    .track-card-grid {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 12px;
        transition: transform 0.2s, background 0.2s;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        border: 1px solid transparent;
    }

    .track-card-grid:hover {
        background: var(--bg-elevated);
        transform: translateY(-4px);
        border-color: rgba(255,255,255,0.05);
    }

    .card-image {
        position: relative;
        width: 100%;
        aspect-ratio: 1/1;
        margin-bottom: 12px;
        border-radius: 8px;
        overflow: hidden;
    }

    .card-image img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .card-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s;
    }

    .track-card-grid:hover .card-overlay {
        opacity: 1;
    }

    .play-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--accent);
        border: none;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transform: scale(0.9);
        transition: transform 0.2s;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }

    .play-btn:hover {
        transform: scale(1);
    }

    .card-info {
        flex: 1;
        display: flex;
        flex-direction: column;
    }

    .card-title {
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-subtitle {
        font-size: 12px;
        color: var(--text-secondary);
        margin-bottom: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-actions {
        margin-top: auto;
        display: flex;
        gap: 8px;
    }
    
    .btn-icon-tiny {
        background: transparent;
        border: 1px solid var(--border);
        color: var(--text-secondary);
        border-radius: 4px;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-icon-tiny:hover {
        background: var(--bg-hover);
        color: white;
        border-color: var(--text-secondary);
    }

    .res-badge {
        position: absolute;
        bottom: 6px;
        right: 6px;
        background: rgba(0,0,0,0.8);
        color: #fbbf24;
        font-size: 9px;
        padding: 2px 4px;
        border-radius: 4px;
        font-weight: 600;
        backdrop-filter: blur(4px);
    }
`;

const styleElement = document.createElement('style');
styleElement.textContent = styles;
if (!document.getElementById('artist-grid-styles')) {
    styleElement.id = 'artist-grid-styles';
    document.head.appendChild(styleElement);
}
