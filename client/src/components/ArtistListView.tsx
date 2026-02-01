import React, { useEffect, useState, useCallback } from 'react';
import { smartFetch } from '../utils/api';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playTrack } from './Player';
import { Icons } from './Icons';

interface ListItem {
    id: string;
    title?: string;
    name?: string;
    duration?: number;
    release_date_original?: string;
    image?: { small?: string; medium?: string; thumbnail?: string };
    hires?: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
}

export const ArtistListView: React.FC = () => {
    const { navData, navigate, activeTab } = useNavigation();
    const { t } = useLanguage();
    const { showToast } = useToast();

    const [items, setItems] = useState<ListItem[]>([]);
    const [artistName, setArtistName] = useState('');
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [offset, setOffset] = useState(0);
    const limit = 50;

    const listType = activeTab === 'artist_albums' ? 'albums' : 'tracks';
    const artistId = navData?.id;

    const fetchItems = useCallback(async (currentOffset: number) => {
        if (!artistId) return;
        setLoading(true);
        try {
            const res = await smartFetch(`/api/artist/${artistId}?limit=${limit}&offset=${currentOffset}&type=${listType}`);
            if (res && res.ok) {
                const data = await res.json();
                setArtistName(data.name || '');
                const listData = data[listType] || { items: [], total: 0 };
                setItems(listData.items || []);
                setTotal(listData.total || 0);
            }
        } catch (err) {
            console.error('Failed to fetch artist items:', err);
            showToast('Failed to load items', 'error');
        } finally {
            setLoading(false);
        }
    }, [artistId, listType, showToast]);

    useEffect(() => {
        setOffset(0);
        fetchItems(0);
    }, [artistId, listType, fetchItems]);

    const handlePrevPage = () => {
        const newOffset = Math.max(0, offset - limit);
        setOffset(newOffset);
        fetchItems(newOffset);
    };

    const handleNextPage = () => {
        const newOffset = offset + limit;
        if (newOffset < total) {
            setOffset(newOffset);
            fetchItems(newOffset);
        }
    };

    const addToQueue = async (type: string, id: string) => {
        try {
            const url = `https://open.qobuz.com/${type}/${id}`;
            await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            showToast(t('msg_added_to_queue'), 'success');
        } catch (e) {
            showToast('Failed to add to queue', 'error');
        }
    };

    const addToBatchStaging = (type: string, id: string) => {
        const url = `https://open.qobuz.com/${type}/${id}`;
        const existing = localStorage.getItem('batch_staging_urls') || '';
        const separator = existing ? '\n' : '';
        localStorage.setItem('batch_staging_urls', existing + separator + url);
        showToast('Added to Batch Staging', 'success');
    };

    return (
        <div className="view-section" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <button className="btn secondary icon-btn" onClick={() => navigate('artist', { id: artistId })} title="Back to Artist">
                    <Icons.ArrowLeft width={18} height={18} />
                </button>
                <div>
                    <h2 style={{ fontSize: '24px', fontWeight: 700 }}>{artistName}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {listType === 'albums' ? 'All Albums' : 'All Tracks'} ({total} {listType})
                    </p>
                </div>
            </div>

            <div className="list-container">
                {listType === 'tracks' && (
                    <div className="list-header" style={{ gridTemplateColumns: '48px 1fr 100px 120px', gap: '24px', padding: '16px 24px' }}>
                        <span>#</span>
                        <span>Title</span>
                        <span>Duration</span>
                        <span>Actions</span>
                    </div>
                )}

                <div className="list-body">
                    {loading ? (
                        <div className="empty-state" style={{ padding: '60px' }}>
                            <div className="spinner"></div>
                            <p>{t('common_loading')}</p>
                        </div>
                    ) : items.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px' }}>
                            <Icons.Search width={48} height={48} style={{ opacity: 0.3, marginBottom: '168px' }} />
                            <p>No {listType} found</p>
                        </div>
                    ) : (
                        items.map((item, idx) => {
                            if (listType === 'albums') {
                                return (
                                    <div key={item.id} className="track-item" onClick={() => navigate('album', { id: item.id })} style={{ cursor: 'pointer', padding: '12px 20px' }}>
                                        <img
                                            src={item.image?.small || item.image?.thumbnail || ''}
                                            style={{ width: '48px', height: '48px', borderRadius: '4px', marginRight: '20px', objectFit: 'cover' }}
                                            loading="lazy"
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: '15px' }}>{item.title}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                {item.release_date_original ? item.release_date_original.slice(0, 4) : ''}
                                            </div>
                                        </div>
                                        <div className="track-actions">
                                            <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); addToQueue('album', item.id); }} title={t('action_download')}><Icons.Download width={16} height={16} /></button>
                                            <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); addToBatchStaging('album', item.id); }} title={t('menu_batch')}><Icons.Batch width={16} height={16} /></button>
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div key={item.id} className="track-item" style={{ display: 'grid', gridTemplateColumns: '48px 1fr 100px 120px', gap: '24px', padding: '12px 24px', alignItems: 'center' }}>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{offset + idx + 1}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: '600', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</div>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                            {item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : '--:--'}
                                        </div>
                                        <div className="track-actions">
                                            <button className="btn-track-dl" onClick={() => addToQueue('track', item.id)} title={t('action_download')}><Icons.Download width={16} height={16} /></button>
                                            <button className="btn-track-dl" onClick={() => addToBatchStaging('track', item.id)} title={t('menu_batch')}><Icons.Batch width={16} height={16} /></button>
                                            <button className="btn-track-dl" onClick={() => playTrack(item.id, item.title || '', artistName, '')} title={t('action_play')}><Icons.Play width={16} height={16} /></button>
                                        </div>
                                    </div>
                                );
                            }
                        })
                    )}
                </div>
            </div>

            {total > limit && (
                <div className="pagination" style={{ marginTop: '32px' }}>
                    <button className="btn secondary" disabled={offset === 0} onClick={handlePrevPage}>
                        <Icons.ArrowLeft width={14} height={14} /> Previous
                    </button>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}
                    </span>
                    <button className="btn secondary" disabled={offset + limit >= total} onClick={handleNextPage}>
                        Next <Icons.ArrowRight width={14} height={14} />
                    </button>
                </div>
            )}
        </div>
    );
};
