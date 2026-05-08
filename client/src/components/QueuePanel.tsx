import React from 'react';
import { Reorder } from 'framer-motion';
import { usePlayer } from '../contexts/PlayerContext';
import { Icons } from './Icons';
import '../styles/QueuePanel.css';

export const QueuePanel: React.FC = () => {
    const { 
        playQueue, 
        setPlayQueue, 
        currentTrackIndex, 
        setCurrentTrackIndex, 
        removeFromQueue, 
        clearQueue, 
        showQueue, 
        setShowQueue 
    } = usePlayer();

    if (!showQueue) return null;

    const handlePlayTrack = (index: number) => {
        setCurrentTrackIndex(index);
    };

    return (
        <div className="queue-panel-overlay" onClick={() => setShowQueue(false)}>
            <div className="queue-panel" onClick={e => e.stopPropagation()}>
                <div className="queue-header">
                    <h3>Playback Queue</h3>
                    <div className="queue-actions">
                        <button className="text-btn" onClick={clearQueue}>Clear All</button>
                        <button className="icon-btn" onClick={() => setShowQueue(false)}>
                            <Icons.Close width={20} height={20} />
                        </button>
                    </div>
                </div>

                <div className="queue-list-container">
                    {playQueue.length === 0 ? (
                        <div className="empty-queue">
                            <Icons.Batch width={48} height={48} opacity={0.2} />
                            <p>Queue is empty</p>
                        </div>
                    ) : (
                        <Reorder.Group 
                            axis="y" 
                            values={playQueue} 
                            onReorder={setPlayQueue}
                            className="queue-list"
                        >
                            {playQueue.map((track, index) => (
                                <Reorder.Item 
                                    key={track.id} 
                                    value={track}
                                    className={`queue-item ${index === currentTrackIndex ? 'active' : ''}`}
                                >
                                    <div className="drag-handle">
                                        <Icons.Batch width={14} height={14} />
                                    </div>
                                    <div className="item-art" onClick={() => handlePlayTrack(index)}>
                                        <img src={track.cover} alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
                                        {index === currentTrackIndex && <div className="playing-indicator">▶</div>}
                                    </div>
                                    <div className="item-info" onClick={() => handlePlayTrack(index)}>
                                        <div className="item-title">{track.title}</div>
                                        <div className="item-artist">{track.artist}</div>
                                    </div>
                                    <button className="remove-btn" onClick={() => removeFromQueue(index)}>
                                        <Icons.Trash width={14} height={14} />
                                    </button>
                                </Reorder.Item>
                            ))}
                        </Reorder.Group>
                    )}
                </div>
            </div>
        </div>
    );
};
