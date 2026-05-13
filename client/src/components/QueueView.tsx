import React, { useEffect, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSocket } from '../contexts/SocketContext';
import { smartFetch, getQualityLabel } from '../utils/api';
import { Icons } from './Icons';
import { useQueueStore, type QueueItem } from '../stores/queueStore';
import { useLanguage } from '../contexts/LanguageContext';

const QueueRow = React.memo(({ item, virtualItem, scrollMargin, handleCancel, handleDownload, t }: { item: QueueItem, virtualItem: any, scrollMargin: number, handleCancel: (id: string) => void, handleDownload: (id: string) => void, t: (key: string) => string }) => {
    return (
        <div
            className="list-row"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start - scrollMargin}px)`,
                display: 'grid',
                gridTemplateColumns: '3fr 0.8fr 1.2fr 1fr 1.5fr 1fr',
                padding: '0 24px',
                borderBottom: '1px solid var(--border)',
                alignItems: 'center',
                fontSize: '14px',
                gap: '24px'
            }}
        >
            <div className="title-cell" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title || 'Loading...'}</div>
                {item.artist && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.artist}</div>}
            </div>
            <div><span className={`badge ${item.type}`}>{item.type}</span></div>
            <div className="quality-cell">{getQualityLabel(item.quality)}</div>
            <div><span className={`badge ${item.status} status-badge`}>{item.status}</span></div>
            <div className="progress-cell" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <div className="progress-bar" style={{ width: '100%' }}>
                    <div className={`progress-fill ${item.status === 'downloading' || item.status === 'processing' ? 'progress-shimmer' : ''}`} style={{ width: `${item.progress || 0}%` }}></div>
                </div>
            </div>
            <div>
                {(item.status === 'downloading' || item.status === 'pending' || item.status === 'processing') ? (
                    <button className="btn danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleCancel(item.id)}>{t('action_cancel')}</button>
                ) : item.status === 'completed' ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }} onClick={() => handleDownload(item.contentId)}>
                            <Icons.Download size={14} /> {t('action_download')}
                        </button>
                        {(window as any).qbzDesktop && (
                            <button 
                                className="btn secondary" 
                                style={{ padding: '6px 8px', display: 'flex', alignItems: 'center' }} 
                                onClick={() => (window as any).qbzDesktop.app.showItem(item.filePath)}
                                title="Open in Explorer"
                            >
                                <Icons.Folder size={14} />
                            </button>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
});

export const QueueView: React.FC = () => {
    const { t } = useLanguage();
    const { socket, connected } = useSocket();
    const { stats, queue, setStats, fetchQueue, updateItemProgress } = useQueueStore();

    const parentRef = useRef<HTMLDivElement>(null);
    const [scrollMargin, setScrollMargin] = React.useState(0);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (listRef.current && parentRef.current) {
            setScrollMargin(listRef.current.offsetTop);
        }
    }, [queue.length]);

    const rowVirtualizer = useVirtualizer({
        count: queue.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 75,
        overscan: 10,
        scrollMargin: scrollMargin,
    });

    useEffect(() => {
        if (!socket || !connected) return;

        fetchQueue();

        const handleQueueUpdate = (newStats: any) => {
            setStats(newStats);
            fetchQueue();
        };

        const handleStats = (newStats: any) => {
            setStats(newStats);
        };

        const handleItemProgress = (data: any) => {
            updateItemProgress(data);
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
    }, [socket, connected, fetchQueue, setStats, updateItemProgress]);

    const handleQueueAction = async (action: 'pause' | 'resume' | 'clear') => {
        await smartFetch('/api/queue/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });
        fetchQueue();
    };

    const handleCancel = useCallback(async (id: string) => {
        await smartFetch(`/api/item/${id}/cancel`, { method: 'POST' });
        fetchQueue();
    }, [fetchQueue]);

    const handleDownload = useCallback((contentId: string) => {
        window.location.href = `/api/download/${contentId}`;
    }, []);

    return (
        <div id="view-queue" ref={parentRef} className="view-section" style={{ display: 'block', overflowY: 'auto' }}>
            <div className="stats-grid shrink-0">
                <div className="stat-card">
                    <h3>{t('label_total')}</h3>
                    <div className="number" id="q-total">{stats.total}</div>
                </div>
                <div className="stat-card">
                    <h3>{t('label_downloading')}</h3>
                    <div className="number text-accent" id="q-downloading">{stats.downloading}</div>
                </div>
                <div className="stat-card">
                    <h3>{t('label_completed')}</h3>
                    <div className="number text-success" id="q-completed">{stats.completed}</div>
                </div>
                <div className="stat-card">
                    <h3>{t('label_failed')}</h3>
                    <div className="number text-danger" id="q-failed">{stats.failed}</div>
                </div>
            </div>

            <div className="queue-toolbar shrink-0">
                <div className="queue-actions">
                    <button className="btn secondary" onClick={() => handleQueueAction('pause')}>
                        <span className="icon"><Icons.Pause width={14} height={14} /></span> {t('action_pause')}
                    </button>
                    <button className="btn secondary" onClick={() => handleQueueAction('resume')}>
                        <span className="icon"><Icons.Play width={14} height={14} /></span> {t('action_resume')}
                    </button>
                    <button className="btn danger" onClick={() => handleQueueAction('clear')}>
                        <span className="icon"><Icons.Trash width={14} height={14} /></span> {t('action_clear')}
                    </button>
                </div>
            </div>

            <div ref={listRef} className="list-container" style={{ background: 'transparent' }}>
                    <div className="list-header" style={{
                        display: 'grid',
                        gridTemplateColumns: '3fr 0.8fr 1.2fr 1fr 1.5fr 1fr',
                        padding: '16px 24px',
                        background: 'var(--bg-elevated)',
                        borderBottom: '2px solid var(--border)',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        gap: '24px',
                        position: 'sticky',
                        top: '-32px',
                        zIndex: 10,
                        margin: '0 -32px 0 -32px',
                        paddingLeft: '56px',
                        paddingRight: '56px'
                    }}>
                    <div>{t('label_title')}</div>
                    <div>{t('label_type')}</div>
                    <div>{t('label_quality')}</div>
                    <div>{t('label_status')}</div>
                    <div>{t('label_progress')}</div>
                    <div>{t('label_action')}</div>
                </div>

                <div className="list-body" style={{ position: 'relative' }}>
                    {queue.length === 0 ? (
                        <div className="empty-state" style={{ padding: '80px 0' }}>
                            <div className="empty-icon"><Icons.Queue width={48} height={48} /></div>
                            <h3>{t('msg_queue_empty')}</h3>
                            <p>{t('msg_add_urls')}</p>
                        </div>
                    ) : (
                        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                            {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                                <QueueRow
                                    key={queue[virtualItem.index].id}
                                    item={queue[virtualItem.index]}
                                    virtualItem={virtualItem}
                                    scrollMargin={scrollMargin}
                                    handleCancel={handleCancel}
                                    handleDownload={handleDownload}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
