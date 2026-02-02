import React, { useState, useCallback, useEffect, useRef } from 'react';
import { smartFetch } from '../utils/api';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { playTrack } from './Player';
import { Icons } from './Icons';

interface SearchResultItem {
    id: string;
    title?: string;
    name?: string;
    artist?: { name: string };
    performer?: { name: string };
    image?: { small?: string; medium?: string; large?: string; thumbnail?: string };
    picture?: { small?: string; medium?: string; large?: string; thumbnail?: string };
    album?: { id: string; title?: string; image?: { small?: string; medium?: string; large?: string } };
    hires?: boolean;
    maximum_bit_depth?: number;
    maximum_sampling_rate?: number;
    already_downloaded?: boolean;
}

type SearchType = 'albums' | 'tracks' | 'artists';
type ViewMode = 'list' | 'grid';

export const SearchView: React.FC = () => {
    const { t } = useLanguage();
    const { navigate, searchState, setSearchState } = useNavigation();
    const { showToast } = useToast();
    const searchBoxRef = useRef<HTMLDivElement>(null);
    const suppressSuggestions = useRef(false);
    const latestQuery = useRef(searchState.query);

    useEffect(() => {
        latestQuery.current = searchState.query;
    }, [searchState.query]);

    const { query, type: searchType, results, total, page } = searchState;
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [suggestions, setSuggestions] = useState<{ artists: any[], albums: any[], tracks: any[] } | null>(null);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [hiResOnly, setHiResOnly] = useState(false);

    const isMount = useRef(true);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        suppressSuggestions.current = false;

        if (isMount.current) {
            isMount.current = false;
            if (results.length > 0) return;
        }

        if (query.trim().length === 0) {
            setSuggestions(null);
            setShowSuggestions(false);
            setLoading(false);
            setSearchState(prev => ({ ...prev, results: [], total: 0 }));
            return;
        }

        const performLiveSearch = async () => {
            if (query.trim().length < 2) {
                setSuggestions(null);
                setShowSuggestions(false);
                return;
            }

            smartFetch(`/api/search/suggestions?query=${encodeURIComponent(query)}`)
                .then(res => (res && res.ok) ? res.json() : null)
                .then(data => {
                    if (data && !suppressSuggestions.current) {
                        setSuggestions(data);
                        setShowSuggestions(true);
                    }
                });

            executeSearch(query, searchType, 0);
        };

        const timer = setTimeout(performLiveSearch, 500);
        return () => clearTimeout(timer);
    }, [query]);



    const safeResults = results || [];

    const filteredResults = safeResults.filter(item => {
        if (!hiResOnly) return true;
        if (searchType === 'artists') return true;
        return item.hires === true;
    });

    const limit = 20;

    const executeSearch = useCallback(async (searchQuery: string, type: SearchType, offset: number = 0) => {
        if (!searchQuery.trim()) return;

        setLoading(true);

        try {
            const url = `/api/search?query=${encodeURIComponent(searchQuery)}&type=${type}&limit=${limit}&offset=${offset}`;
            const res = await smartFetch(url);

            if (searchQuery !== latestQuery.current) return;

            if (res && res.ok) {
                const data = await res.json();
                const itemsData = data[type] || { items: [], total: 0 };

                setSearchState(prev => ({
                    ...prev,
                    query: searchQuery,
                    type: type,
                    results: itemsData.items || [],
                    total: itemsData.total || 0,
                    page: Math.floor(offset / limit)
                }));
            }
        } catch (err) {
            console.error('Search error:', err);
            showToast('Search failed', 'error');
        } finally {
            if (searchQuery === latestQuery.current) {
                setLoading(false);
            }
        }
    }, [showToast, setSearchState]);

    const handleSearch = () => {
        if (query.trim()) {
            suppressSuggestions.current = true;
            executeSearch(query, searchType, 0);
            setShowSuggestions(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
    };

    const handleTypeChange = (newType: SearchType) => {
        setSearchState(prev => ({ ...prev, type: newType }));
        if (query.trim()) {
            executeSearch(query, newType, 0);
            setShowSuggestions(false);
        }
    };

    const handlePrevPage = () => {
        const newOffset = (page - 1) * limit;
        if (newOffset >= 0) {
            executeSearch(query, searchType, newOffset);
        }
    };

    const handleNextPage = () => {
        const newOffset = (page + 1) * limit;
        if (newOffset < total) {
            executeSearch(query, searchType, newOffset);
        }
    };

    const addToQueue = async (itemType: string, id: string | number) => {
        if (!id) {
            showToast('Invalid content ID', 'error');
            return;
        }
        try {
            await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: itemType, id: String(id) })
            });
            showToast(t('msg_added_to_queue'), 'success');
        } catch (e) {
            showToast('Failed to add to queue', 'error');
        }
    };

    const addToBatchStaging = (itemType: string, id: string) => {
        const url = `https://open.qobuz.com/${itemType}/${id}`;
        const existing = localStorage.getItem('batch_staging_urls') || '';
        const separator = existing ? '\n' : '';
        if (existing.includes(url)) {
            showToast('Already in Batch Staging', 'info');
            return;
        }
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

    const handleCardClick = (item: SearchResultItem, itemType: string) => {
        if (itemType === 'album') {
            navigate('album', { id: item.id });
        } else if (itemType === 'artist') {
            navigate('artist', { id: item.id });
        } else if (itemType === 'track' && item.album?.id) {
            navigate('album', { id: item.album.id });
        }
    };

    const getItemType = (): string => {
        return searchType.slice(0, -1);
    };

    const hasSearched = safeResults.length > 0 || (total === 0 && query !== '');

    return (
        <div id="view-search" className="view-section" style={{ display: 'block' }}>
            <div className="search-container">
                <div className="search-box" ref={searchBoxRef}>
                    <input
                        type="text"
                        id="search-input"
                        placeholder={t('common_search_placeholder')}
                        value={query}
                        onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
                        onKeyDown={handleKeyDown}
                        autoComplete="off"
                        onFocus={() => query.length >= 2 && setShowSuggestions(true)}
                    />
                    <button className="btn primary" id="search-btn" onClick={handleSearch}>
                        <span className="icon"><Icons.Search width={16} height={16} /></span> {t('menu_search')}
                    </button>

                    {showSuggestions && suggestions && (
                        <div className="search-suggestions-dropdown" style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            marginTop: '8px',
                            zIndex: 1000,
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            padding: '8px',
                            maxHeight: '400px',
                            overflowY: 'auto'
                        }}>
                            {/* Artists Section */}
                            {suggestions.artists.length > 0 && (
                                <div className="suggestion-section">
                                    <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Artists</div>
                                    {suggestions.artists.map(a => (
                                        <div key={a.id} className="suggestion-item" onClick={() => { navigate('artist', { id: a.id }); setShowSuggestions(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                                                {a.image?.small || a.picture?.small ? <img src={a.image?.small || a.picture?.small} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icons.Library style={{ padding: '8px', opacity: 0.5 }} />}
                                            </div>
                                            <span>{a.name}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Albums Section */}
                            {suggestions.albums.length > 0 && (
                                <div className="suggestion-section">
                                    <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Albums</div>
                                    {suggestions.albums.map(a => (
                                        <div key={a.id} className="suggestion-item" onClick={() => { navigate('album', { id: a.id }); setShowSuggestions(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                                                {a.image?.small ? <img src={a.image.small} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icons.Library style={{ padding: '8px', opacity: 0.5 }} />}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px' }}>{a.title}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{a.artist?.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Tracks Section */}
                            {suggestions.tracks.length > 0 && (
                                <div className="suggestion-section">
                                    <div style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 'bold', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Tracks</div>
                                    {suggestions.tracks.map(t => (
                                        <div key={t.id} className="suggestion-item" onClick={() => { navigate('album', { id: t.album?.id }); setShowSuggestions(false); }} style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'var(--bg-dark)', overflow: 'hidden' }}>
                                                {t.album?.image?.small ? <img src={t.album.image.small} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Icons.Library style={{ padding: '8px', opacity: 0.5 }} />}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px' }}>{t.title}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{t.performer?.name}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}


                </div>
                <div className="search-controls" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div className="search-types">
                        {(['albums', 'tracks', 'artists'] as const).map(typeOption => (
                            <button
                                key={typeOption}
                                className={`type-btn ${searchType === typeOption ? 'active' : ''}`}
                                onClick={() => handleTypeChange(typeOption)}
                            >
                                {typeOption.charAt(0).toUpperCase() + typeOption.slice(1)}
                            </button>
                        ))}
                        {searchType !== 'artists' && (
                            <button
                                className={`type-btn ${hiResOnly ? 'active' : ''}`}
                                onClick={() => setHiResOnly(!hiResOnly)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    ...(hiResOnly ? { background: 'var(--hires)', borderColor: 'transparent' } : {})
                                }}
                            >
                                <Icons.Settings width={14} height={14} />
                                <span>Hi-Res Only</span>
                            </button>
                        )}
                    </div>
                    <div className="view-mode-toggle" style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '4px' }}>
                        <button
                            onClick={() => setViewMode('list')}
                            className={viewMode === 'list' ? 'active' : ''}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                borderRadius: '6px',
                                background: viewMode === 'list' ? 'var(--accent-primary)' : 'transparent',
                                color: viewMode === 'list' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            title="List View"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </svg>
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={viewMode === 'grid' ? 'active' : ''}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                border: 'none',
                                borderRadius: '6px',
                                background: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                                color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            title="Grid View"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div id="search-results" className="results-container">
                {loading && (
                    <div className="empty-state" style={{ padding: '40px' }}>
                        <div className="spinner"></div>
                        <p>{t('common_loading')}</p>
                    </div>
                )}

                {!loading && filteredResults.length === 0 && (
                    <div className="empty-state" style={{ padding: '60px' }}>
                        <div className="empty-icon"><Icons.Search width={48} height={48} /></div>
                        <h3>{hasSearched ? t('msg_no_results') : t('msg_start_searching')}</h3>
                        <p>{hasSearched ? t('msg_try_keywords') : t('msg_enter_keywords')}</p>
                    </div>
                )}

                {!loading && filteredResults.length > 0 && (
                    <div className={viewMode === 'list' ? 'track-list' : 'results-grid'} style={viewMode === 'list' ? { display: 'flex', flexDirection: 'column', gap: '4px' } : undefined}>
                        {filteredResults.map(item => {
                            const itemType = getItemType();
                            const title = item.title || item.name || 'Unknown';
                            const artistName = item.artist?.name || item.performer?.name || '';
                            const albumTitle = item.album?.title || '';

                            let cover = '';
                            if (itemType === 'artist') {
                                cover = item.image?.medium || item.image?.small || item.image?.thumbnail || item.picture?.medium || item.picture?.small || '';
                            } else if (itemType === 'track') {
                                cover = item.album?.image?.medium || item.album?.image?.small || item.album?.image?.large ||
                                    item.image?.medium || item.image?.small || item.image?.thumbnail || '';
                            } else {
                                cover = item.image?.medium || item.image?.small || item.image?.large || item.image?.thumbnail ||
                                    item.album?.image?.medium || '';
                            }

                            const isHiRes = !!item.hires;
                            const bitDepth = item.maximum_bit_depth || (isHiRes ? 24 : 16);
                            const samplingRate = item.maximum_sampling_rate || 44.1;
                            const qualityText = isHiRes ? `${bitDepth}-bit / ${samplingRate}kHz` : 'CD';

                            if (viewMode === 'list') {
                                return (
                                    <div
                                        key={item.id}
                                        className="track-item"
                                        onClick={() => handleCardClick(item, itemType)}
                                        style={{ cursor: 'pointer', padding: '10px 16px', borderRadius: '8px' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: 0 }}>
                                            {cover ? (
                                                <img src={cover} style={{ width: '44px', height: '44px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} loading="lazy" />
                                            ) : (
                                                <div style={{ width: '44px', height: '44px', borderRadius: '4px', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Icons.Library width={20} height={20} style={{ opacity: 0.5 }} />
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {itemType === 'track' ? `${artistName} • ${albumTitle}` : artistName}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {item.already_downloaded && (
                                                <div className="hq-badge" style={{ position: 'static', margin: 0, fontSize: '10px', padding: '2px 6px', background: 'var(--success)', color: '#fff' }}>Downloaded</div>
                                            )}
                                            {itemType !== 'artist' && (
                                                <div className={`hires-badge ${isHiRes ? 'hires' : 'cd'}`} style={{ position: 'static', margin: 0, fontSize: '10px', padding: '2px 6px' }}>{qualityText}</div>
                                            )}
                                            <div className="result-badge" style={{ position: 'static', margin: 0, opacity: 0.6, fontSize: '10px' }}>{itemType}</div>
                                            <div className="track-actions" style={{ marginLeft: '8px' }}>
                                                {itemType !== 'artist' ? (
                                                    <>
                                                        <button
                                                            className={`btn-track-dl ${item.already_downloaded ? 'disabled' : ''}`}
                                                            onClick={(e) => { e.stopPropagation(); if (!item.already_downloaded) addToQueue(itemType, item.id); }}
                                                            title={item.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                                            disabled={item.already_downloaded}
                                                            style={item.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                                        >
                                                            <Icons.Download width={14} height={14} />
                                                        </button>
                                                        {itemType === 'track' && <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); playTrack(item.id, title, artistName, cover, item.album?.id, filteredResults); }} title={t('action_play')}><Icons.Play width={14} height={14} /></button>}
                                                        <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); addToBatchStaging(itemType, item.id); }} title={t('menu_batch')}><Icons.Batch width={14} height={14} /></button>
                                                        {itemType === 'track' && <button className="btn-track-dl" onClick={(e) => { e.stopPropagation(); downloadLyrics(item.id); }} title="Download Lyrics"><Icons.Mic width={14} height={14} /></button>}
                                                    </>
                                                ) : (
                                                    <button className="btn-track-dl" style={{ fontSize: '12px', padding: '4px 10px' }}>View</button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            } else {
                                return (
                                    <div
                                        key={item.id}
                                        className="grid-item"
                                        onClick={() => handleCardClick(item, itemType)}
                                    >
                                        <div className="grid-cover-container">
                                            {cover ? (
                                                <img src={cover} className="grid-cover" alt={title} loading="lazy" />
                                            ) : (
                                                <div className="grid-cover" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Icons.Library width={48} height={48} style={{ opacity: 0.2 }} />
                                                </div>
                                            )}
                                            <div className="grid-cover-overlay">
                                                {itemType === 'track' ? (
                                                    <button className="grid-play-btn" onClick={(e) => { e.stopPropagation(); playTrack(item.id, title, artistName, cover, item.album?.id, filteredResults); }}>
                                                        <Icons.Play width={24} height={24} />
                                                    </button>
                                                ) : (
                                                    <span style={{ color: 'white', fontWeight: 'bold' }}>View</span>
                                                )}
                                            </div>
                                            {itemType !== 'artist' && (
                                                <div className={`grid-badge-quality ${isHiRes ? 'hires' : ''}`}>
                                                    {isHiRes ? 'HI-RES' : 'CD'}
                                                </div>
                                            )}
                                        </div>
                                        <div className="grid-info">
                                            <div className="grid-badge-type">{itemType}</div>
                                            <div className="grid-title" title={title}>{title}</div>
                                            <div className="grid-artist" title={artistName}>{artistName}</div>
                                        </div>
                                        <div className="grid-actions">
                                            {itemType !== 'artist' && (
                                                <>
                                                    <button
                                                        className="grid-action-btn"
                                                        onClick={(e) => { e.stopPropagation(); if (!item.already_downloaded) addToQueue(itemType, item.id); }}
                                                        title={item.already_downloaded ? 'Already Downloaded' : t('action_download')}
                                                        disabled={item.already_downloaded}
                                                        style={item.already_downloaded ? { opacity: 0.5, cursor: 'not-allowed', background: 'var(--success)', color: '#fff' } : {}}
                                                    >
                                                        {item.already_downloaded ? <Icons.Check width={14} height={14} /> : <Icons.Download width={14} height={14} />}
                                                    </button>
                                                    <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); addToBatchStaging(itemType, item.id); }} title={t('menu_batch')}>
                                                        <Icons.Batch width={14} height={14} />
                                                    </button>
                                                    {itemType === 'track' && (
                                                        <button className="grid-action-btn" onClick={(e) => { e.stopPropagation(); downloadLyrics(item.id); }} title="Download Lyrics">
                                                            <Icons.Mic width={14} height={14} />
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                )}
            </div>

            {!loading && total > limit && (
                <div id="search-pagination" className="pagination">
                    <button disabled={page === 0} onClick={handlePrevPage}>← Prev</button>
                    <span style={{ padding: '0 16px', color: 'var(--text-secondary)' }}>
                        Page {page + 1} of {Math.ceil(total / limit)}
                    </span>
                    <button disabled={(page + 1) * limit >= total} onClick={handleNextPage}>Next →</button>
                </div>
            )}
        </div>
    );
};
