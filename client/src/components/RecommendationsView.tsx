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
            const res = await smartFetch('/api/library/recommendations?limit=24');
            if (res && res.ok) {
                const data = await res.json();
                setRecommendations(data);
            }
        } catch (error) {
            console.error('Failed to fetch recommendations:', error);
            showToast('Failed to load recommendations', 'error');
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
                <div className="recommendations-header-premium skeleton-container">
                    <div className="skeleton" style={{ width: '300px', height: '48px', borderRadius: '12px' }}></div>
                    <div className="skeleton" style={{ width: '120px', height: '44px', borderRadius: '22px' }}></div>
                </div>
                <div className="results-grid">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="skeleton premium-card-skeleton" style={{ height: '320px', borderRadius: '20px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="view-section animate-in">
            <div className="recommendations-header-premium">
                <div className="header-content">
                    <div className="header-badge">
                        <span className="badge-pulse"></span>
                        {t('label_new') || 'NEW'}
                    </div>
                    <h2 className="premium-title">
                        <span className="title-gradient">{t('title_recommendations') || 'Recommended'}</span>
                    </h2>
                    <p className="premium-subtitle">
                        {t('desc_recommendations') || 'Tailored to your musical taste'}
                    </p>
                </div>
                <button 
                    className={`refresh-btn-premium ${refreshing ? 'loading' : ''}`} 
                    onClick={() => fetchRecommendations(true)}
                    disabled={refreshing}
                >
                    <Icons.Refresh className={refreshing ? 'spin' : ''} width={20} height={20} />
                    <span>{t('action_refresh') || 'Refresh'}</span>
                </button>
            </div>

            {recommendations.length === 0 ? (
                <div className="empty-state-premium">
                    <div className="empty-icon-glow">🔮</div>
                    <h3>{t('msg_not_enough_data') || 'Not enough data'}</h3>
                    <p>{t('msg_not_enough_data_desc') || 'Start exploring to get recommendations.'}</p>
                    <button className="btn primary" onClick={() => navigate('search')}>
                        {t('menu_search')}
                    </button>
                </div>
            ) : (
                <div className="results-grid">
                    {recommendations.map((album, idx) => (
                        <div 
                            key={album.id} 
                            className="recommend-card-premium"
                            style={{ animationDelay: `${idx * 0.03}s` }}
                            onClick={() => navigate('album', { id: album.id })}
                        >
                            <div className="card-image-container">
                                <img 
                                    src={album.image?.large || album.image?.medium} 
                                    className="card-image" 
                                    alt={album.title} 
                                    loading="lazy"
                                />
                                <div className="card-overlay-premium">
                                    <div className="overlay-actions">
                                        <button 
                                            className="action-pill play"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate('album', { id: album.id });
                                            }}
                                        >
                                            <Icons.Play width={18} height={18} />
                                            <span>{t('action_play')}</span>
                                        </button>
                                        <button 
                                            className="action-pill queue"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                addToQueue(album.id);
                                            }}
                                        >
                                            <Icons.Download width={18} height={18} />
                                        </button>
                                    </div>
                                </div>
                                {album.hires && (
                                    <div className="hires-badge-premium">
                                        <span className="hires-text">HI-RES</span>
                                        {album.maximum_sampling_rate && (
                                            <span className="hires-specs">{album.maximum_sampling_rate}kHz</span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="card-meta">
                                <div className="album-title-premium" title={album.title}>{album.title}</div>
                                <div className="artist-name-premium">{album.artist?.name}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                .recommendations-header-premium {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 40px;
                    padding: 40px;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.05) 50%, transparent 100%);
                    border-radius: 32px;
                    border: 1px solid var(--border);
                    position: relative;
                    overflow: hidden;
                    backdrop-filter: blur(20px);
                }
                .recommendations-header-premium::before {
                    content: '';
                    position: absolute;
                    top: -50%;
                    left: -20%;
                    width: 140%;
                    height: 140%;
                    background: radial-gradient(circle at center, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
                    z-index: -1;
                    pointer-events: none;
                }
                .header-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    background: rgba(99, 102, 241, 0.2);
                    border-radius: 100px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #818cf8;
                    margin-bottom: 16px;
                    letter-spacing: 0.1em;
                    border: 1px solid rgba(99, 102, 241, 0.3);
                }
                .badge-pulse {
                    width: 6px;
                    height: 6px;
                    background: #818cf8;
                    border-radius: 50%;
                    box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.7);
                    animation: pulse 2s infinite;
                }
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0.7); }
                    70% { box-shadow: 0 0 0 10px rgba(129, 140, 248, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(129, 140, 248, 0); }
                }
                .premium-title {
                    margin: 0;
                    font-size: 3.5rem;
                    font-weight: 900;
                    letter-spacing: -0.04em;
                    line-height: 1;
                }
                .title-gradient {
                    background: var(--gradient-text);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }
                .premium-subtitle {
                    margin: 16px 0 0 0;
                    font-size: 1.1rem;
                    color: var(--text-secondary);
                    font-weight: 500;
                    opacity: 0.8;
                }
                .refresh-btn-premium {
                    background: var(--bg-hover);
                    border: 1px solid var(--border);
                    color: var(--text-primary);
                    padding: 12px 28px;
                    border-radius: 100px;
                    font-weight: 700;
                    font-size: 0.95rem;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
                    backdrop-filter: blur(10px);
                }
                .refresh-btn-premium:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: scale(1.05);
                    border-color: rgba(255, 255, 255, 0.3);
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                }
                .refresh-btn-premium:active {
                    transform: scale(0.98);
                }
                .recommend-card-premium {
                    background: var(--bg-card);
                    border-radius: 24px;
                    border: 1px solid var(--border);
                    overflow: hidden;
                    cursor: pointer;
                    transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
                    opacity: 0;
                    transform: translateY(30px);
                    animation: cardFadeIn 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
                }
                @keyframes cardFadeIn {
                    to { opacity: 1; transform: translateY(0); }
                }
                .recommend-card-premium:hover {
                    background: var(--bg-hover);
                    transform: translateY(-12px);
                    border-color: rgba(99, 102, 241, 0.3);
                    box-shadow: 0 25px 60px -15px rgba(0,0,0,var(--player-shadow-opacity, 0.3));
                }
                .card-image-container {
                    position: relative;
                    aspect-ratio: 1;
                    overflow: hidden;
                    margin: 12px;
                    border-radius: 18px;
                    background: var(--bg-dark);
                }
                .card-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .recommend-card-premium:hover .card-image {
                    transform: scale(1.1) rotate(1deg);
                }
                .card-overlay-premium {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%);
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                    padding: 24px;
                    opacity: 0;
                    transition: all 0.4s ease;
                    transform: translateY(20px);
                }
                .recommend-card-premium:hover .card-overlay-premium {
                    opacity: 1;
                    transform: translateY(0);
                }
                .overlay-actions {
                    display: flex;
                    gap: 10px;
                    width: 100%;
                }
                .action-pill {
                    padding: 10px 16px;
                    border-radius: 12px;
                    border: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.3s;
                }
                .action-pill.play {
                    flex: 1;
                    background: white;
                    color: black;
                }
                .action-pill.play:hover {
                    background: #e2e2e2;
                    transform: scale(1.05);
                }
                .action-pill.queue {
                    background: rgba(255, 255, 255, 0.15);
                    color: white;
                    width: 44px;
                    backdrop-filter: blur(10px);
                }
                .action-pill.queue:hover {
                    background: rgba(255, 255, 255, 0.25);
                    transform: scale(1.1);
                }
                .hires-badge-premium {
                    position: absolute;
                    top: 16px;
                    left: 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    background: rgba(253, 186, 116, 0.95);
                    color: black;
                    padding: 4px 10px;
                    border-radius: 8px;
                    backdrop-filter: blur(5px);
                    box-shadow: 0 8px 16px rgba(0,0,0,0.4);
                }
                .hires-text { font-size: 0.7rem; font-weight: 900; letter-spacing: 0.05em; }
                .hires-specs { font-size: 0.6rem; font-weight: 700; opacity: 0.8; }
                
                .card-meta {
                    padding: 4px 16px 20px 16px;
                }
                .album-title-premium {
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    margin-bottom: 4px;
                }
                .artist-name-premium {
                    font-size: 0.9rem;
                    color: var(--text-secondary);
                    opacity: 0.7;
                    font-weight: 500;
                }
                
                .empty-state-premium {
                    text-align: center;
                    padding: 100px 40px;
                    background: var(--bg-card);
                    border-radius: 40px;
                    border: 1px dashed var(--border);
                }
                .empty-icon-glow {
                    font-size: 5rem;
                    margin-bottom: 24px;
                    filter: drop-shadow(0 0 20px rgba(99, 102, 241, 0.4));
                }
                .empty-state-premium h3 { font-size: 1.8rem; margin-bottom: 12px; }
                .empty-state-premium p { max-width: 500px; margin: 0 auto 32px auto; opacity: 0.6; line-height: 1.6; }
                
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .animate-in {
                    animation: sectionIn 1s cubic-bezier(0.23, 1, 0.32, 1) forwards;
                }
                @keyframes sectionIn {
                    from { opacity: 0; transform: translateY(40px); filter: blur(10px); }
                    to { opacity: 1; transform: translateY(0); filter: blur(0); }
                }
            `}} />
        </div>
    );
};
