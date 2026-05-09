import React, { useState, useEffect } from 'react';
import { smartFetch } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './Icons';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';

interface RecommendedAlbum {
    id: string;
    title: string;
    artist: { name: string };
    image: { large: string; medium: string; small: string };
    hires: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
}

export const RecommendationsView: React.FC = () => {
    const { t } = useLanguage();
    const { navigate } = useNavigation();
    const { showToast } = useToast();
    const [recommendations, setRecommendations] = useState<RecommendedAlbum[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchRecommendations = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        
        try {
            const res = await smartFetch('/api/library/recommendations?limit=12');
            if (res && res.ok) {
                const data = await res.json();
                setRecommendations(data);
            }
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, []);

    const addToQueue = async (id: string) => {
        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'album', id })
            });
            if (res && res.ok) {
                showToast(t('msg_added_to_queue'), 'success');
            }
        } catch (e) {
            showToast('Failed to add to queue', 'error');
        }
    };

    if (loading) {
        return (
            <div className="view-section">
                <div className="recommendations-header" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: '250px', height: '36px', borderRadius: '8px' }}></div>
                    <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '20px' }}></div>
                </div>
                <div className="results-grid">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '280px', borderRadius: '12px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="view-section animate-in">
            <div className="recommendations-header" style={{ 
                marginBottom: '40px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.1) 0%, transparent 100%)',
                padding: '24px',
                borderRadius: '16px',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                backdropFilter: 'blur(10px)'
            }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ color: 'var(--accent)' }}>✨</span> {t('title_recommendations') || 'Recommended for You'}
                    </h2>
                    <p style={{ margin: '8px 0 0 0', opacity: 0.7, fontSize: '0.95rem' }}>
                        Based on your listening history and local library
                    </p>
                </div>
                <button 
                    className={`btn secondary ${refreshing ? 'loading' : ''}`} 
                    onClick={() => fetchRecommendations(true)}
                    style={{ 
                        borderRadius: '24px', 
                        padding: '10px 24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                >
                    <Icons.Refresh className={refreshing ? 'spin' : ''} width={18} height={18} />
                    <span>{t('action_refresh') || 'Refresh'}</span>
                </button>
            </div>

            {recommendations.length === 0 ? (
                <div className="empty-state" style={{ padding: '80px 0' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🔮</div>
                    <h3>Not enough data yet</h3>
                    <p>Start listening to some music or scan your library to get personalized recommendations.</p>
                </div>
            ) : (
                <div className="results-grid">
                    {recommendations.map((album, idx) => (
                        <div 
                            key={album.id} 
                            className="grid-item recommend-card"
                            style={{ 
                                animationDelay: `${idx * 0.05}s`,
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                            }}
                            onClick={() => navigate('album', { id: album.id })}
                        >
                            <div className="grid-cover-container" style={{ position: 'relative' }}>
                                <img 
                                    src={album.image?.large || album.image?.medium} 
                                    className="grid-cover" 
                                    alt={album.title} 
                                    loading="lazy"
                                />
                                <div className="grid-cover-overlay" style={{
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    padding: '16px',
                                    gap: '10px'
                                }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button 
                                            className="grid-play-btn" 
                                            style={{ width: '40px', height: '40px' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                // Recommendations are albums, so we might want to play the first track or view it
                                                navigate('album', { id: album.id });
                                            }}
                                        >
                                            <Icons.Play width={20} height={20} />
                                        </button>
                                        <button 
                                            className="grid-play-btn" 
                                            style={{ width: '40px', height: '40px', background: 'rgba(255,255,255,0.1)' }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToQueue(album.id);
                                            }}
                                            title="Add to Queue"
                                        >
                                            <Icons.Download width={18} height={18} />
                                        </button>
                                    </div>
                                </div>
                                {album.hires && (
                                    <div className="grid-badge-quality hires" style={{
                                        position: 'absolute',
                                        top: '12px',
                                        right: '12px',
                                        background: 'var(--hires)',
                                        padding: '4px 8px',
                                        borderRadius: '6px',
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        color: '#000',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                                    }}>
                                        HI-RES
                                    </div>
                                )}
                            </div>
                            <div className="grid-info" style={{ padding: '16px' }}>
                                <div className="grid-title" style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '4px' }}>{album.title}</div>
                                <div className="grid-artist" style={{ opacity: 0.6, fontSize: '0.9rem' }}>{album.artist?.name}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .recommend-card:hover {
                    transform: translateY(-8px) scale(1.02);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                }
                .recommend-card:hover .grid-cover {
                    transform: scale(1.1);
                }
                .animate-in {
                    animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
};
