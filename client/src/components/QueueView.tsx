import React, { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { smartFetch, getQualityLabel } from '../utils/api';
import { Icons } from './Icons';

interface QueueStats {
    total: number;
    downloading: number;
    completed: number;
    failed: number;
    pending: number;
}

interface QueueItem {
    id: string;
    contentId: string;
    title: string;
    type: string;
    quality: number;
    status: 'pending' | 'downloading' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    artist?: string;
    album?: string;
}

export const QueueView: React.FC = () => {
    const { socket } = useSocket();
    const [stats, setStats] = useState<QueueStats>({ total: 0, downloading: 0, completed: 0, failed: 0, pending: 0 });
    const [queue, setQueue] = useState<QueueItem[]>([]);

    const fetchQueue = useCallback(async () => {
        const res = await smartFetch('/api/queue');
        if (res && res.ok) {
            const data = await res.json();
            setQueue(data);
        }
    }, []);

    useEffect(() => {
        if (!socket) return;

        fetchQueue();

        const handleQueueUpdate = (newStats: QueueStats) => {
            setStats(newStats);
            fetchQueue();
        };

        const handleStats = (newStats: QueueStats) => {
            setStats(newStats);
        };

        const handleItemProgress = (data: any) => {
            setQueue(prev => prev.map(item => {
                if (item.id === data.id) {
                    return { ...item, ...data };
                }
                return item;
            }));
        };

        const handleRefresh = () => {
            fetchQueue();
        };

        socket.on('queue:update', handleQueueUpdate);
        socket.on('queue:stats', handleStats);
        socket.on('item:added', handleRefresh);
        socket.on('item:completed', handleRefresh);
        socket.on('item:failed', handleRefresh);
        socket.on('item:progress', handleItemProgress);

        return () => {
            socket.off('queue:update', handleQueueUpdate);
            socket.off('queue:stats', handleStats);
            socket.off('item:added', handleRefresh);
            socket.off('item:completed', handleRefresh);
            socket.off('item:failed', handleRefresh);
            socket.off('item:progress', handleItemProgress);
        };
    }, [socket, fetchQueue]);

    const handleQueueAction = async (action: 'pause' | 'resume' | 'clear') => {
        await smartFetch('/api/queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        fetchQueue();
    };

    const handleCancel = async (id: string) => {
        await smartFetch(`/api/item/${id}/cancel`, { method: 'POST' });
        fetchQueue();
    };

    const handleDownload = (contentId: string) => {
        window.location.href = `/api/download/${contentId}`;
    };

    return (
        <div id="view-queue" className="view-section" style={{ display: 'block' }}>
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total</h3>
                    <div className="number" id="q-total">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <h3>Downloading</h3>
                    <div className="number text-accent" id="q-downloading">{stats.downloading}</div>
                </div>
                <div className="stat-card">
                    <h3>Completed</h3>
                    <div className="number text-success" id="q-completed">{stats.completed}</div>
                </div>
                <div className="stat-card">
                    <h3>Failed</h3>
                    <div className="number text-danger" id="q-failed">{stats.failed}</div>
                </div>
            </div>

            <div className="queue-toolbar">
                <div className="queue-actions">
                    <button className="btn secondary" onClick={() => handleQueueAction('pause')}>
                        <span className="icon"><Icons.Pause width={14} height={14} /></span> Pause
                    </button>
                    <button className="btn secondary" onClick={() => handleQueueAction('resume')}>
                        <span className="icon"><Icons.Play width={14} height={14} /></span> Resume
                    </button>
                    <button className="btn danger" onClick={() => handleQueueAction('clear')}>
                        <span className="icon"><Icons.Trash width={14} height={14} /></span> Clear All
                    </button>
                </div>
            </div>

            <div className="list-container">
                <div className="list-header" style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 1.2fr 1fr 1.5fr 1fr', padding: '16px 24px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', gap: '24px' }}>
                    <div>Title</div>
                    <div>Type</div>
                    <div>Quality</div>
                    <div>Status</div>
                    <div>Progress</div>
                    <div>Action</div>
                </div>
                <div id="queue-list" className="list-body">
                    {queue.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><Icons.Queue width={48} height={48} /></div>
                            <h3>Queue is Empty</h3>
                            <p>Add URLs to start downloading</p>
                        </div>
                    ) : (
                        queue.map(item => (
                            <div key={item.id} className="list-row" style={{ display: 'grid', gridTemplateColumns: '3fr 0.8fr 1.2fr 1fr 1.5fr 1fr', padding: '18px 24px', borderBottom: '1px solid var(--border)', alignItems: 'center', fontSize: '14px', gap: '24px' }}>
                                <div className="title-cell">
                                    <div style={{ fontWeight: 600 }}>{item.title || 'Loading...'}</div>
                                    {item.artist && <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{item.artist}</div>}
                                </div>
                                <div><span className={`badge ${item.type}`}>{item.type}</span></div>
                                <div className="quality-cell">{getQualityLabel(item.quality)}</div>
                                <div><span className={`badge ${item.status} status-badge`}>{item.status}</span></div>
                                <div className="progress-cell">
                                    <div className="progress-bar">
                                        <div className={`progress-fill ${item.status === 'downloading' || item.status === 'processing' ? 'progress-shimmer' : ''}`} style={{ width: `${item.progress || 0}%` }}></div>
                                    </div>
                                </div>
                                <div>
                                    {(item.status === 'downloading' || item.status === 'pending' || item.status === 'processing') ? (
                                        <button className="btn danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleCancel(item.id)}>Cancel</button>
                                    ) : item.status === 'completed' ? (
                                        <button className="btn primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleDownload(item.contentId)}>
                                            <Icons.Download width={12} height={12} /> Download
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};