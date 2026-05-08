import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import '../styles/MiniPlayer.css';

export const MiniPlayer: React.FC = () => {
    const [track, setTrack] = useState<any>(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);

    const desktopBridge = window.qbzDesktop;

    useEffect(() => {
        if (!desktopBridge) return;

        const cleanup = desktopBridge.miniPlayer.onPlayerEvent((type: string, data: any) => {
            if (type === 'state') {
                if (data.track) setTrack(data.track);
                setPlaying(data.playing);
                setProgress(data.progress);
                setDuration(data.duration);
                if (data.accent) {
                    document.documentElement.style.setProperty('--accent', data.accent);
                }
            }
        });

        // Tell main window we are ready for state
        desktopBridge.miniPlayer.sendPlayerEvent('request-state', {});

        return () => cleanup();
    }, [desktopBridge]);

    const handleAction = (action: string) => {
        desktopBridge?.miniPlayer.sendPlayerEvent('command', { action });
    };

    const handleClose = () => {
        desktopBridge?.miniPlayer.toggle();
    };

    if (!track) {
        return (
            <div className="mini-player-empty">
                <div className="mini-player-drag-handle"></div>
                <p>Waiting for track...</p>
                <button onClick={handleClose} className="mini-close" style={{ pointerEvents: 'auto' }}>
                    <Icons.Close width={14} height={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="mini-player">
            <div className="mini-player-drag-handle"></div>
            <div className="mini-player-content">
                <img src={track.cover} alt="" className="mini-cover" />
                <div className="mini-info">
                    <div className="mini-title" title={track.title}>{track.title}</div>
                    <div className="mini-artist" title={track.artist}>{track.artist}</div>
                </div>
                <div className="mini-controls">
                    <button onClick={() => handleAction('prev')} title="Previous"><Icons.SkipBack width={16} /></button>
                    <button onClick={() => handleAction('toggle')} className="mini-play-btn" title={playing ? 'Pause' : 'Play'}>
                        {playing ? <Icons.Pause width={16} /> : <Icons.Play width={16} />}
                    </button>
                    <button onClick={() => handleAction('next')} title="Next"><Icons.SkipForward width={16} /></button>
                </div>
                <button onClick={handleClose} className="mini-close" title="Close Mini Player">
                    <Icons.Close width={14} height={14} />
                </button>
            </div>
            <div className="mini-progress-container">
                <div 
                    className="mini-progress-bar" 
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                />
            </div>
        </div>
    );
};
