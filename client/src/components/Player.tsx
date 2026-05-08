import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';
import { LyricsEditor } from './LyricsEditor';
import { useToast } from '../contexts/ToastContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useTheme } from '../contexts/ThemeContext';
import { extractRGB } from '../utils/colorExtractor';
import { AudioVisualizer } from './AudioVisualizer';

import '../styles/Player.css';

interface TrackInfo {
    id: string;
    title: string;
    artist: string;
    cover: string;
    albumId?: string;
    trackNumber?: number;
    duration?: number;
    contextTracks?: any[];
}

interface PlayerProps {
    sidebarCollapsed?: boolean;
}

export const Player: React.FC<PlayerProps> = ({ sidebarCollapsed = false }) => {
    const { showToast } = useToast();
    const {
        showLyrics, setShowLyrics,
        isLyricsFullscreen, setIsLyricsFullscreen,
        showEditor, setShowEditor,
        playQueue, setPlayQueue,
        currentTrackIndex, setCurrentTrackIndex,
        addToPlaybackQueue, removeFromQueue,
        showQueue, setShowQueue
    } = usePlayer();
    const { setDynamicAccent } = useTheme();

    const { activeTab } = useNavigation();



    useEffect(() => {
        setShowLyrics(false);
        setIsLyricsFullscreen(false);
    }, [activeTab, setShowLyrics, setIsLyricsFullscreen]);

    const track = currentTrackIndex >= 0 && currentTrackIndex < playQueue.length ? playQueue[currentTrackIndex] : null;
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [quality, setQuality] = useState<string | null>(null);

    useEffect(() => {
        if (track && track.cover) {
            extractRGB(track.cover).then(color => {
                setDynamicAccent(color, 'player');
            });
        } else {
            setDynamicAccent(null, 'player');
        }
    }, [track?.cover, setDynamicAccent]);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const [lyrics, setLyrics] = useState<{ time: number, text: string }[] | null>(null);
    const [lyricsRaw, setLyricsRaw] = useState<string>('');
    const [activeLyricIndex, setActiveLyricIndex] = useState<number>(-1);
    const lyricsContainerRef = useRef<HTMLDivElement>(null);

    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<any>(null);

    useEffect(() => {
        if (!track) {
            setQuality(null);
            return;
        }

        smartFetch(`/api/preview/${track.id}`)
            .then(res => res ? res.json() : null)
            .then(data => {
                if (data && data.qualityLabel) {
                    setQuality(data.qualityLabel);
                }
            })
            .catch(() => { });
    }, [track]);

    useEffect(() => {
        if (!track) return;
        setLyrics(null);
        setLyricsRaw('');

        smartFetch(`/api/lyrics/${track.id}`)
            .then(res => res ? res.json() : null)
            .then(data => {
                if (data) {
                    if (data.parsedLyrics) setLyrics(data.parsedLyrics);
                    if (data.syncedLyrics) setLyricsRaw(data.syncedLyrics);
                    else if (data.plainLyrics) setLyricsRaw(data.plainLyrics);
                }
            })
            .catch(() => { });
    }, [track]);

    useEffect(() => {
        const handleLrcDrop = async (e: any) => {
            if (!track) {
                showToast('Play a song first to import lyrics', 'error');
                return;
            }

            const { content, fileName } = e.detail;
            try {
                const res = await smartFetch(`/api/lyrics/${track.id}/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content })
                });

                if (res && res.ok) {
                    showToast(`Lyrics imported: ${fileName}`, 'success');
                    // Refresh lyrics
                    setLyricsRaw(content);
                    // Use the existing logic to parse lyrics (assuming it exists in a utility or I can parse it here)
                    // For now, let's just refetch to be sure or use a local parser if available.
                    smartFetch(`/api/lyrics/${track.id}`)
                        .then(r => r?.json())
                        .then(data => {
                            if (data?.parsedLyrics) setLyrics(data.parsedLyrics);
                        });
                } else {
                    showToast('Failed to save lyrics', 'error');
                }
            } catch (err) {
                showToast('Error importing lyrics', 'error');
            }
        };

        window.addEventListener('qbz:lrc-dropped', handleLrcDrop);
        return () => window.removeEventListener('qbz:lrc-dropped', handleLrcDrop);
    }, [track, showToast]);

    useEffect(() => {
        if (!lyrics) return;
        const index = lyrics.findIndex((l, i) => {
            const next = lyrics[i + 1];
            return l.time / 1000 <= progress && (!next || next.time / 1000 > progress);
        });
        if (index !== activeLyricIndex) {
            setActiveLyricIndex(index);
        }
    }, [progress, lyrics]);

    useEffect(() => {
        if (showLyrics && activeLyricIndex !== -1 && lyricsContainerRef.current && !isUserScrolling.current) {
            const container = lyricsContainerRef.current;
            const activeEl = container.children[activeLyricIndex] as HTMLElement;

            if (activeEl) {
                const containerHeight = container.clientHeight;
                const elHeight = activeEl.clientHeight;
                const elTop = activeEl.offsetTop;
                const targetScroll = elTop - (containerHeight / 2) + (elHeight / 2);

                const startScroll = container.scrollTop;
                const distance = targetScroll - startScroll;
                const duration = 600;
                const startTime = performance.now();

                const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

                const animateScroll = (currentTime: number) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    const ease = easeOutCubic(progress);

                    container.scrollTop = startScroll + (distance * ease);

                    if (progress < 1) {
                        requestAnimationFrame(animateScroll);
                    }
                };

                requestAnimationFrame(animateScroll);
            }
        }
    }, [activeLyricIndex, showLyrics]);

    const handleLyricsScroll = () => {
        isUserScrolling.current = true;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

        scrollTimeout.current = setTimeout(() => {
            isUserScrolling.current = false;
        }, 3000);
    };

    useEffect(() => {
        const handlePlayEvent = (e: CustomEvent<TrackInfo>) => {
            addToPlaybackQueue(e.detail, true);
            setPlaying(true);
        };

        window.addEventListener('player:play', handlePlayEvent as EventListener);
        return () => {
            window.removeEventListener('player:play', handlePlayEvent as EventListener);
        };
    }, []);



    useEffect(() => {
        if (track && audioRef.current) {

            audioRef.current.src = `/api/preview/${track.id}/stream`;
            audioRef.current.play().catch(e => console.error(e));
        }
    }, [track]);



    useEffect(() => {
        if (audioRef.current) {
            if (playing) audioRef.current.play().catch(() => { });
            else audioRef.current.pause();
        }
    }, [playing]);

    const togglePlay = React.useCallback(() => setPlaying(prev => !prev), []);

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) audioRef.current.currentTime = time;
        setProgress(time);
    };

    const handleNext = React.useCallback(async () => {
        if (!track) {
            setPlaying(false);
            return;
        }

        if (track.contextTracks && track.contextTracks.length > 0) {
            const currentIndex = track.contextTracks.findIndex((t: any) => String(t.id) === String(track.id));
            if (currentIndex !== -1 && currentIndex < track.contextTracks.length - 1) {
                const nextT = track.contextTracks[currentIndex + 1];
                const title = nextT.title || nextT.name || "Unknown";
                const artist = nextT.artist?.name || nextT.performer?.name || track.artist;
                let nextCover = '';
                if (nextT.image) {
                    nextCover = nextT.image.large || nextT.image.medium || nextT.image.small || nextT.image.thumbnail || '';
                }
                if (!nextCover && nextT.album?.image) {
                    nextCover = nextT.album.image.large || nextT.album.image.medium || nextT.album.image.small || '';
                }
                if (!nextCover && nextT.picture) {
                    nextCover = nextT.picture.large || nextT.picture.medium || nextT.picture.small || '';
                }

                const finalCover = nextCover || track.cover;

                playTrack(
                    String(nextT.id),
                    title,
                    artist,
                    finalCover,
                    nextT.albumId || nextT.album?.id || track.albumId,
                    track.contextTracks
                );
                return;
            } else {
                setPlaying(false);
                return;
            }
        }

        if (!track.albumId) {
            setPlaying(false);
            return;
        }

        try {
            const res = await smartFetch(`/api/album/${track.albumId}`);
            if (res && res.ok) {
                const data = await res.json();
                if (data.tracks && data.tracks.items) {
                    const tracks = data.tracks.items;
                    const currentIndex = tracks.findIndex((t: any) => String(t.id) === String(track.id));

                    if (currentIndex !== -1 && currentIndex < tracks.length - 1) {
                        const nextTrack = tracks[currentIndex + 1];
                        const artistName = nextTrack.performer?.name || nextTrack.artist?.name || track.artist;
                        playTrack(
                            String(nextTrack.id),
                            nextTrack.title,
                            artistName,
                            track.cover,
                            track.albumId
                        );
                    } else {
                        setPlaying(false);
                    }
                } else {
                    setPlaying(false);
                }
            } else {
                setPlaying(false);
            }
        } catch (e) {
            console.error('Failed to skip to next track', e);
            setPlaying(false);
        }
    }, [track]);

    const handlePrevious = React.useCallback(async () => {
        if (audioRef.current && audioRef.current.currentTime > 3) {
            audioRef.current.currentTime = 0;
            return;
        }

        if (!track || !track.albumId) {
            return;
        }

        try {
            const res = await smartFetch(`/api/album/${track.albumId}`);
            if (res && res.ok) {
                const data = await res.json();
                if (data.tracks && data.tracks.items) {
                    const tracks = data.tracks.items;
                    const currentIndex = tracks.findIndex((t: any) => String(t.id) === String(track.id));

                    if (currentIndex > 0) {
                        const prevTrack = tracks[currentIndex - 1];
                        const artistName = prevTrack.performer?.name || prevTrack.artist?.name || track.artist;
                        playTrack(
                            String(prevTrack.id),
                            prevTrack.title,
                            artistName,
                            track.cover,
                            track.albumId
                        );
                    }
                }
            }
        } catch (e) {
            console.error('Failed to go to prev track', e);
        }
    }, [track]);

    // Mini Player Sync
    useEffect(() => {
        const desktopBridge = window.qbzDesktop;
        if (!desktopBridge) return;

        const syncState = () => {
            desktopBridge.miniPlayer.sendPlayerEvent('state', {
                track,
                playing,
                progress,
                duration,
                accent: document.documentElement.style.getPropertyValue('--accent')
            });
        };

        // Sync on changes
        syncState();

        const cleanup = desktopBridge.miniPlayer.onPlayerEvent((type, data) => {
            if (type === 'command') {
                switch (data.action) {
                    case 'toggle': togglePlay(); break;
                    case 'next': handleNext(); break;
                    case 'prev': handlePrevious(); break;
                }
            } else if (type === 'request-state') {
                syncState();
            }
        });

        return () => cleanup();
    }, [track, playing, progress, duration, togglePlay, handleNext, handlePrevious]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isTextInput =
                target.tagName === 'TEXTAREA' ||
                (target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'range') ||
                target.isContentEditable;

            if (isTextInput) return;

            switch (e.key) {
                case ' ':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    if ((target as HTMLInputElement).type !== 'range') {
                        e.preventDefault();
                        handleNext();
                    }
                    break;
                case 'ArrowLeft':
                    if ((target as HTMLInputElement).type !== 'range') {
                        e.preventDefault();
                        handlePrevious();
                    }
                    break;
                case 'MediaPlayPause':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'MediaTrackNext':
                    e.preventDefault();
                    handleNext();
                    break;
                case 'MediaTrackPrevious':
                    e.preventDefault();
                    handlePrevious();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay, handleNext, handlePrevious]);

    const addToQueue = async () => {
        if (!track) return;
        try {
            await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'track', id: track.id })
            });
            showToast('Added to queue', 'success');
        } catch (e) {
            showToast('Failed to add to queue', 'error');
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getQualityColor = (q: string) => {
        if (q.includes('24-bit')) return '#FFD700';
        if (q.includes('16-bit')) return '#00FFFF';
        return 'rgba(255,255,255,0.6)';
    };

    if (!track) return null;

    const sidebarWidth = sidebarCollapsed ? 80 : 256;

    const lyricsContent = (
        <div className={`lyrics-overlay ${showLyrics ? 'visible' : ''} ${isLyricsFullscreen ? 'fullscreen' : ''}`}>
            <div className="lyrics-header">
                <div className="album-art-large">
                    <img src={track.cover} alt="" />
                </div>
                <div className="track-info-large">
                    <h2>{track.title}</h2>
                    <p>{track.artist}</p>
                    {quality && (
                        <div className="quality-badge-large" style={{ color: getQualityColor(quality) }}>
                            {quality.includes('24-bit') && <span className="hi-res-label" style={{ background: getQualityColor(quality) }}>HI-RES</span>}
                            <span>{quality}</span>
                        </div>
                    )}
                </div>
                <div className="lyrics-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', marginTop: '4px' }}>
                    <button className="icon-btn" onClick={() => setShowEditor(true)} title="Edit Lyrics">
                        <Icons.Edit width={20} />
                    </button>
                    <button className="icon-btn" onClick={() => setIsLyricsFullscreen(!isLyricsFullscreen)} title="Toggle Fullscreen">
                        {isLyricsFullscreen ? <Icons.Minimize width={20} /> : <Icons.Maximize width={20} />}
                    </button>
                </div>
            </div>
            {showEditor && track && lyricsRaw && (
                <LyricsEditor
                    track={track}
                    initialContent={lyricsRaw}
                    currentTime={progress}
                    onSave={() => {
                        setShowEditor(false);
                        smartFetch(`/api/lyrics/${track.id}`)
                            .then(res => res ? res.json() : null)
                            .then(data => {
                                if (data) {
                                    if (data.parsedLyrics) setLyrics(data.parsedLyrics);
                                    if (data.syncedLyrics) setLyricsRaw(data.syncedLyrics);
                                }
                            });
                    }}
                    onClose={() => setShowEditor(false)}
                    audioRef={audioRef as React.RefObject<HTMLAudioElement>}
                />
            )}
            <div
                className="lyrics-scroll"
                ref={lyricsContainerRef}
                onScroll={handleLyricsScroll}
            >
                {!lyrics ? (
                    <div className="lyrics-empty">Searching for lyrics...</div>
                ) : (
                    lyrics.map((line, i) => {
                        const next = lyrics[i + 1];
                        const isActive = line.time / 1000 <= progress && (!next || next.time / 1000 > progress);
                        return (
                            <p
                                key={i}
                                className={`lyric-line ${isActive ? 'active' : ''} ${progress < line.time / 1000 ? 'future' : ''}`}
                                onClick={() => {
                                    if (audioRef.current) audioRef.current.currentTime = line.time / 1000;
                                }}
                            >
                                {line.text}
                            </p>
                        );
                    })
                )}
            </div>
        </div>
    );

    return (
        <div 
            className={`audio-player-wrapper ${track ? 'active' : ''}`}
            style={{
                left: `calc(50% + ${sidebarWidth / 2}px)`,
                width: `calc(100% - ${sidebarWidth + 48}px)`
            }}
        >

            {/* Lyrics Overlay */}
            {isLyricsFullscreen ? createPortal(lyricsContent, document.body) : lyricsContent}

            <div className="audio-player-glass">
                <audio
                    ref={audioRef}
                    crossOrigin="anonymous"
                    onTimeUpdate={(e) => {
                        setProgress(e.currentTarget.currentTime);
                        setDuration(e.currentTarget.duration || 0);
                    }}
                    onLoadedMetadata={(e) => {

                        setDuration(e.currentTarget.duration);
                        if (playing) e.currentTarget.play().catch(console.error);
                    }}
                    onEnded={handleNext}
                    onError={(e) => console.error('Audio Error', e)}
                />

                <div className="player-left">
                    <div className="album-art">
                        <img src={track?.cover || ''} alt={track?.title || ''} onError={(e) => e.currentTarget.style.display = 'none'} />
                        <div className="visualizer-overlay">
                            <AudioVisualizer 
                                audioElement={audioRef.current} 
                                isPlaying={playing} 
                                color="var(--accent)"
                                barCount={32}
                            />
                        </div>
                    </div>
                    <div className="track-details">
                        <div className="track-title" title={track?.title}>{track?.title}</div>
                        <div className="track-subtitle">
                            <div className="track-artist" title={track?.artist}>{track?.artist}</div>
                            {quality && (
                                <div
                                    className="quality-badge-mini"
                                    style={{
                                        borderColor: getQualityColor(quality),
                                        color: getQualityColor(quality),
                                        boxShadow: `0 0 4px ${getQualityColor(quality)}40`
                                    }}
                                >
                                    {quality.replace('FLAC ', '').replace('kbps', '')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="player-center">
                    <div className="main-controls">
                        <button className="control-btn secondary" onClick={handlePrevious} title="Previous">
                            <Icons.SkipBack width={24} height={24} />
                        </button>
                        <button className="play-pause-btn" onClick={togglePlay}>
                            {playing ? <Icons.Pause width={20} height={20} fill="currentColor" stroke="none" /> : <Icons.Play width={20} height={20} fill="currentColor" stroke="none" style={{ marginLeft: 3 }} />}
                        </button>
                        <button className="control-btn secondary" onClick={handleNext} title="Next">
                            <Icons.SkipForward width={24} height={24} />
                        </button>
                    </div>
                    <div className="progress-wrapper">
                        <span className="time-text">{formatTime(progress)}</span>
                        <div className="slider-container">
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                value={progress || 0}
                                onChange={handleSeek}
                                className="seek-slider"
                                style={{
                                    background: `linear-gradient(to right, var(--text-primary) ${(progress / (duration || 1)) * 100}%, var(--progress-bg) ${(progress / (duration || 1)) * 100}%)`
                                }}
                            />
                        </div>
                        <span className="time-text">{formatTime(duration)}</span>
                    </div>
                </div>

                <div className="player-right">

                    <div className="action-buttons">
                        <button
                            className={`icon-btn ${showLyrics ? 'active-btn' : ''}`}
                            onClick={() => setShowLyrics(!showLyrics)}
                            title="Lyrics"
                            style={{ color: showLyrics ? 'var(--accent)' : '' }}
                        >
                            <Icons.Mic width={18} height={18} />
                        </button>
                        <button
                            className={`icon-btn ${showQueue ? 'active-btn' : ''}`}
                            onClick={() => setShowQueue(!showQueue)}
                            title="Queue"
                            style={{ color: showQueue ? 'var(--accent)' : '' }}
                        >
                            <Icons.Batch width={18} height={18} />
                        </button>
                        <button className="icon-btn" onClick={addToQueue} title="Download">
                            <Icons.Download width={18} height={18} />
                        </button>
                        {window.qbzDesktop && (
                            <button 
                                className="icon-btn" 
                                onClick={() => window.qbzDesktop?.miniPlayer.toggle()} 
                                title="Mini Player"
                            >
                                <Icons.Monitor width={18} height={18} />
                            </button>
                        )}
                        <div className="divider"></div>
                        <button className="icon-btn close-btn" onClick={() => { setPlaying(false); setTrack(null); setShowLyrics(false); }}>
                            <Icons.Close width={20} height={20} />
                        </button>
                    </div>
                </div>
            </div>

        </div>
    );
};

export const playTrack = (id: string, title: string, artist: string, cover: string, albumId?: string, contextTracks?: any[]) => {
    window.dispatchEvent(new CustomEvent('player:play', {
        detail: { id, title, artist, cover, albumId, contextTracks }
    }));
};
