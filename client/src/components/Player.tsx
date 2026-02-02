import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';
import { LyricsEditor } from './LyricsEditor';
import { useToast } from '../contexts/ToastContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useNavigation } from '../contexts/NavigationContext';

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
        showEditor, setShowEditor
    } = usePlayer();

    const { activeTab } = useNavigation();

    useEffect(() => {
        setShowLyrics(false);
        setIsLyricsFullscreen(false);
    }, [activeTab, setShowLyrics, setIsLyricsFullscreen]);

    const [track, setTrack] = useState<TrackInfo | null>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [quality, setQuality] = useState<string | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const ctxRef = useRef<AudioContext | null>(null);

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
            setTrack(e.detail);
            setPlaying(true);
        };

        window.addEventListener('player:play', handlePlayEvent as EventListener);
        return () => {
            window.removeEventListener('player:play', handlePlayEvent as EventListener);
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);

    const startVisualizer = () => {
        if (!canvasRef.current || !analyserRef.current) return;

        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current!.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;

                const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#6366f1';
                canvasCtx.fillStyle = accent;
                canvasCtx.globalAlpha = 0.6;
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        };

        draw();
    };

    useEffect(() => {
        if (playing && audioRef.current && !ctxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            ctxRef.current = new AudioContext();
            const analyser = ctxRef.current.createAnalyser();
            analyser.fftSize = 64;
            const source = ctxRef.current.createMediaElementSource(audioRef.current);
            source.connect(analyser);
            analyser.connect(ctxRef.current.destination);
            analyserRef.current = analyser;
        }

        if (playing && ctxRef.current?.state === 'suspended') {
            ctxRef.current.resume();
        }

        if (playing) startVisualizer();
        else if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }, [playing, track]);

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



    const togglePlay = () => setPlaying(!playing);
    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(e.target.value);
        if (audioRef.current) audioRef.current.currentTime = time;
        setProgress(time);
    };

    const handleNext = async () => {
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
    };

    const handlePrevious = async () => {
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
    };

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
    const playerWidth = 1100;

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
        <div className={`audio-player-wrapper ${track ? 'active' : ''}`}>

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
                        <div className={`visualizer-calm ${playing ? 'playing' : ''}`}>
                            <span></span><span></span><span></span><span></span>
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
                        <button className="icon-btn" onClick={addToQueue} title="Download">
                            <Icons.Download width={18} height={18} />
                        </button>
                        <div className="divider"></div>
                        <button className="icon-btn close-btn" onClick={() => { setPlaying(false); setTrack(null); setShowLyrics(false); }}>
                            <Icons.Close width={20} height={20} />
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                .audio-player-wrapper {
                    position: fixed;
                    bottom: 30px;
                    left: calc(50% + ${sidebarWidth / 2}px);
                    transform: translateX(-50%) translateY(20px) scale(0.98);
                    width: calc(100% - ${sidebarWidth + 48}px);
                    max-width: ${playerWidth}px;
                    display: flex;
                    justify-content: center;
                    pointer-events: none;
                    z-index: 2000;
                    opacity: 0;
                    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                }

                .audio-player-wrapper.active {
                    opacity: 1;
                    transform: translateX(-50%) translateY(0) scale(1);
                    pointer-events: auto;
                }

                /* Lyrics Overlay */
                .lyrics-overlay {
                    position: absolute;
                    bottom: 110px;
                    left: 0;
                    right: 0;
                    height: 0;
                    background: var(--lyrics-bg);
                    backdrop-filter: blur(50px) saturate(180%);
                    -webkit-backdrop-filter: blur(50px) saturate(180%);
                    border-radius: 32px;
                    border: 1px solid var(--player-border);
                    overflow: hidden;
                    opacity: 0;
                    transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 60px;
                    box-shadow: 0 40px 80px rgba(0,0,0,0.6);
                    padding: 0 60px;
                }
                
                .lyrics-overlay.visible {
                    height: 550px;
                    opacity: 1;
                    padding: 60px 40px;
                }

                .lyrics-overlay.fullscreen {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100vw;
                    height: 100vh;
                    z-index: 3000;
                    border-radius: 0;
                    padding: 0 80px;
                    background: var(--lyrics-fullscreen-bg);
                    flex-direction: row;
                    justify-content: center;
                    align-items: center;
                    gap: 100px;
                }

                .lyrics-overlay.fullscreen .lyrics-header {
                    width: 400px;
                    max-width: 400px;
                    align-items: flex-start;
                    text-align: left;
                    margin-bottom: 0;
                    flex-shrink: 0;
                }

                .lyrics-overlay.fullscreen .album-art-large {
                    width: 350px;
                    height: 350px;
                    margin-bottom: 24px;
                    box-shadow: 0 30px 60px rgba(0,0,0,0.5);
                }

                .lyrics-overlay.fullscreen .track-info-large {
                    align-items: flex-start;
                }
                
                .lyrics-overlay.fullscreen .track-info-large h2 {
                    font-size: 38px;
                    margin-bottom: 12px;
                }
                
                .lyrics-overlay.fullscreen .track-info-large p {
                    font-size: 24px;
                }

                .lyrics-overlay.fullscreen .lyrics-actions {
                    justify-content: flex-start !important;
                    margin-top: 16px;
                }

                .lyrics-overlay.fullscreen .lyrics-scroll {
                    max-width: 800px;
                    text-align: left;
                    padding: 0 40px;
                }

                .lyrics-overlay.fullscreen .lyrics-scroll .lyric-line {
                    font-size: 34px;
                    margin: 24px 0;
                    transform-origin: left center;
                }

                .lyrics-overlay.fullscreen .lyric-line {
                    font-size: 36px;
                    margin: 28px 0;
                }

                .lyrics-overlay.fullscreen .lyric-line.active {
                    transform: scale(1.08);
                    color: var(--accent, #fff);
                }

                .lyrics-header {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 20px;
                    margin-bottom: 0px;
                    width: 300px;
                    flex-shrink: 0;
                    text-align: left;
                }

                .album-art-large {
                    width: 280px;
                    height: 280px;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 12px 32px rgba(0,0,0,0.4);
                    margin-bottom: 16px;
                }
                
                .album-art-large img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .track-info-large h2 {
                    font-size: 24px;
                    font-weight: 700;
                    margin: 0 0 8px 0;
                    color: var(--text-primary);
                    line-height: 1.2;
                }
                
                .track-info-large {
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                }

                .quality-badge-large {
                    margin-top: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: var(--text-secondary);
                    font-weight: 500;
                    letter-spacing: 0.5px;
                }

                .hi-res-label {
                    background: #f4c430;
                    color: #000;
                    font-size: 10px;
                    font-weight: 900;
                    padding: 2px 6px;
                    border-radius: 4px;
                    letter-spacing: 1px;
                }

                .track-subtitle {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    min-width: 0;
                    margin-top: 2px;
                }

                .track-artist {
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-right: 8px;
                }

                .quality-badge-mini {
                    font-size: 9px;
                    padding: 1px 5px;
                    border: 1px solid rgba(255,255,255,0.2);
                    border-radius: 4px;
                    flex-shrink: 0;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                    white-space: nowrap;
                }

                .lyrics-scroll {
                    width: 100%;
                    max-width: 500px;
                    flex: 1;
                    height: 100%;
                    overflow-y: auto;
                    text-align: left;
                    padding: 0 20px;
                    scroll-behavior: smooth;
                }
                
                .lyrics-empty {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    font-size: 16px;
                }

                .lyrics-scroll::-webkit-scrollbar {
                    width: 0px;
                }

                .lyric-line {
                    font-size: 20px;
                    font-weight: 500;
                    color: var(--text-secondary);
                    margin: 16px 0;
                    transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    cursor: pointer;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    word-break: break-word;
                    transform-origin: left center;
                }

                .lyric-line:hover {
                    color: var(--text-primary);
                }

                .lyric-line.active {
                    color: var(--text-primary);
                    transform: scale(1.05);
                    font-weight: 700;
                    text-shadow: 0 0 40px rgba(0,0,0,0.1);
                    opacity: 1;
                    transform-origin: left center;
                }


                
                /* End Lyrics Styles */

                .audio-player-glass {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    height: 84px;
                    padding: 0 24px;
                    border-radius: 20px;
                    background: var(--player-bg);
                    backdrop-filter: blur(24px) saturate(180%);
                    -webkit-backdrop-filter: blur(24px) saturate(180%);
                    border: 1px solid var(--player-border);
                    box-shadow: 
                        0 24px 48px -12px rgba(0, 0, 0, 0.6),
                        inset 0 1px 0 var(--player-border);
                }

                /* Left Section */
                .player-left {
                    display: flex;
                    align-items: center;
                    width: 28%;
                    gap: 20px;
                }

                .album-art {
                    position: relative;
                    width: 64px;
                    height: 64px;
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.4);
                    flex-shrink: 0;
                    background: #222;
                }

                .album-art img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .visualizer-calm {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.3);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.3s;
                }

                .visualizer-calm.playing {
                    opacity: 1;
                }

                .visualizer-calm span {
                    width: 4px;
                    height: 12px;
                    background: var(--text-primary);
                    border-radius: 2px;
                    animation: bounce 1s infinite ease-in-out;
                }

                .visualizer-calm span:nth-child(2) { animation-delay: 0.1s; height: 18px; }
                .visualizer-calm span:nth-child(3) { animation-delay: 0.2s; height: 24px; }
                .visualizer-calm span:nth-child(4) { animation-delay: 0.3s; height: 16px; }

                @keyframes bounce {
                    0%, 100% { transform: scaleY(1); opacity: 0.8; }
                    50% { transform: scaleY(0.4); opacity: 0.5; }
                }

                .track-details {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    overflow: hidden;
                    gap: 4px;
                }

                .track-title {
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--text-primary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .track-artist {
                    font-size: 13px;
                    color: var(--text-secondary);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                /* Center Section */
                .player-center {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    padding: 0 48px;
                    gap: 10px;
                }

                .main-controls {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                }

                .control-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    transition: all 0.2s;
                }

                .control-btn:hover {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }

                .play-pause-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    background: var(--text-primary);
                    color: var(--bg-card);
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 0 20px rgba(0, 0, 0, 0.25);
                    transition: all 0.2s ease;
                }

                .play-pause-btn svg {
                     display: block;
                }

                .play-pause-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 25px rgba(0, 0, 0, 0.45);
                }

                .progress-wrapper {
                    display: flex;
                    align-items: center;
                    width: 100%;
                    gap: 16px;
                }

                .time-text {
                    font-size: 12px;
                    color: var(--text-secondary);
                    font-family: 'Geist Mono', monospace;
                    min-width: 40px;
                    text-align: center;
                }

                .slider-container {
                    flex: 1;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    position: relative;
                }

                .seek-slider {
                    -webkit-appearance: none;
                    width: 100%;
                    height: 4px;
                    border-radius: 2px;
                    background: var(--progress-bg);
                    outline: none;
                    cursor: pointer;
                }

                .seek-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: var(--text-primary);
                    box-shadow: 0 0 10px rgba(0,0,0,0.5);
                    cursor: pointer;
                    transform: scale(0);
                    transition: transform 0.1s;
                }

                .slider-container:hover .seek-slider::-webkit-slider-thumb {
                    transform: scale(1);
                }

                /* Right Section */
                .player-right {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    width: 28%;
                    gap: 32px; /* Increased from 24px */
                }

                .volume-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 120px;
                }

                .volume-slider {
                    -webkit-appearance: none;
                    flex: 1;
                    height: 4px;
                    border-radius: 2px;
                    background: var(--progress-bg);
                    outline: none;
                    cursor: pointer;
                }

                .volume-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: var(--text-primary);
                    cursor: pointer;
                }

                .action-buttons {
                    display: flex;
                    align-items: center;
                    gap: 12px; /* Decreased slightly for cohesion */
                    background: var(--player-border);
                    padding: 6px;
                    border-radius: 30px;
                    border: 1px solid var(--player-border);
                }

                .divider {
                    width: 1px;
                    height: 20px;
                    background: var(--border-light);
                }

                .icon-btn {
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    padding: 8px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .icon-btn:hover {
                    color: var(--text-primary);
                    background: var(--bg-hover);
                }
                
                .main-controls {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                }

                .play-pause-btn {
                    width: 40px; /* Reduced from 48px */
                    height: 40px; /* Reduced from 48px */
                    border-radius: 50%;
                    background: #fff;
                    color: #000;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    box-shadow: 0 0 20px rgba(255, 255, 255, 0.25);
                    transition: all 0.2s ease;
                }

                .icon-btn.close-btn:hover {
                    background: rgba(255, 59, 48, 0.2);
                    color: #ff3b30;
                }

                /* Mobile Responsive */
                @media (max-width: 768px) {
                    .audio-player-wrapper {
                        left: 50%;
                        width: 95%;
                        bottom: 16px;
                        max-width: 100%;
                    }

                    .audio-player-glass {
                        height: auto;
                        flex-direction: column;
                        padding: 16px;
                        gap: 20px;
                    }

                    .player-left, .player-center, .player-right {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .player-center {
                        padding: 0;
                        gap: 16px;
                    }

                    .track-details {
                        flex: 1;
                    }
                    
                    .volume-wrapper {
                        flex: 1;
                    }
                }
            `}</style>
        </div>
    );
};

export const playTrack = (id: string, title: string, artist: string, cover: string, albumId?: string, contextTracks?: any[]) => {
    window.dispatchEvent(new CustomEvent('player:play', {
        detail: { id, title, artist, cover, albumId, contextTracks }
    }));
};
