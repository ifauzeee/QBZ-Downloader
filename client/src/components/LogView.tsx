import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { smartFetch } from '../utils/api';
import { Icons } from './Icons';
import { useSocket } from '../contexts/SocketContext';

interface LogEntry {
    timestamp: string;
    type: string;
    scope: string;
    message: string;
    time: number;
}

const getTypeColor = (type: string) => {
    switch (type) {
        case 'success': return '#4ade80';
        case 'warn': return '#facc15';
        case 'error': return '#f87171';
        case 'debug': return '#c084fc';
        case 'system': return '#22d3ee';
        default: return '#94a3b8';
    }
};

const LogLine = React.memo(({ log, virtualItem }: { log: LogEntry, virtualItem: any }) => {
    return (
        <div
            className="log-line"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
                display: 'flex',
                gap: '16px',
                borderBottom: '1px solid var(--border)',
                padding: '2px 0',
                alignItems: 'center'
            }}
        >
            <span style={{ color: 'var(--text-secondary)', minWidth: '85px', userSelect: 'none', fontSize: '11px', opacity: 0.8 }}>{log.timestamp}</span>
            <div style={{ display: 'flex', minWidth: '80px' }}>
                <span style={{
                    color: getTypeColor(log.type),
                    fontWeight: '700',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    background: `${getTypeColor(log.type)}15`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'inline-block',
                    textAlign: 'center',
                    minWidth: '60px'
                }}>
                    {log.type}
                </span>
            </div>
            <span style={{ color: 'var(--text-secondary)', minWidth: '90px', fontWeight: 600, fontSize: '11px' }}>{log.scope}</span>
            <span style={{ color: log.type === 'error' ? 'var(--danger)' : 'var(--text-primary)', wordBreak: 'break-word', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</span>
        </div>
    );
});

export const LogView: React.FC = () => {
    const { socket } = useSocket();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [filter, setFilter] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const parentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await smartFetch('/api/logs');
                if (res && res.ok) {
                    const data = await res.json();
                    setLogs(data);
                }
            } catch (e) {
                console.error('Failed to fetch logs', e);
            }
        };

        fetchLogs();
    }, []);

    const filteredLogs = useMemo(() => logs.filter(log =>
        log.message.toLowerCase().includes(filter.toLowerCase()) ||
        log.scope.toLowerCase().includes(filter.toLowerCase()) ||
        log.type.toLowerCase().includes(filter.toLowerCase())
    ), [logs, filter]);

    const rowVirtualizer = useVirtualizer({
        count: filteredLogs.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 32,
        overscan: 20,
    });

    useEffect(() => {
        if (!socket) return;

        const handleNewLog = (log: LogEntry) => {
            setLogs(prev => {
                const newLogs = [...prev, log];
                if (newLogs.length > 2000) return newLogs.slice(newLogs.length - 2000);
                return newLogs;
            });
        };

        socket.on('log:new', handleNewLog);

        return () => {
            socket.off('log:new', handleNewLog);
        };
    }, [socket]);

    useEffect(() => {
        if (autoScroll && filteredLogs.length > 0) {
            rowVirtualizer.scrollToIndex(filteredLogs.length - 1, { behavior: 'smooth' });
        }
    }, [filteredLogs.length, autoScroll, rowVirtualizer]);

    const handleScroll = () => {
        if (!parentRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

        if (isAtBottom && !autoScroll) {
            setAutoScroll(true);
        } else if (!isAtBottom && autoScroll) {
            setAutoScroll(false);
        }
    };

    return (
        <div id="view-logs" className="view-section active" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="list-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '15px 20px', borderRadius: '12px', border: '1px solid var(--border)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                    <div className="search-input-wrapper" style={{ flex: 1, maxWidth: '400px' }}>
                        <Icons.Search className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filter logs..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            style={{ width: '100%', padding: '10px 10px 10px 40px', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', transition: 'border-color 0.2s' }}
                        />
                    </div>
                    <div
                        onClick={() => setAutoScroll(!autoScroll)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: autoScroll ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: 500, userSelect: 'none' }}
                    >
                        <div style={{
                            width: '16px', height: '16px',
                            borderRadius: '4px',
                            border: `2px solid ${autoScroll ? 'var(--accent)' : 'var(--text-secondary)'}`,
                            background: autoScroll ? 'var(--accent)' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s'
                        }}>
                            {autoScroll && <Icons.Check width={12} height={12} color="#fff" />}
                        </div>
                        Auto-scroll
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn secondary" onClick={() => setLogs([])} style={{ fontSize: '13px' }}>Clear</button>
                    <button className="btn secondary" onClick={() => {
                        const content = logs.map(l => `[${l.timestamp}] [${l.type.toUpperCase()}] [${l.scope}] ${l.message}`).join('\n');
                        const blob = new Blob([content], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `qbz-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
                        a.click();
                    }} style={{ fontSize: '13px' }}>Download</button>
                </div>
            </div>

            <div
                className="log-container"
                ref={parentRef}
                onScroll={handleScroll}
                style={{
                    background: 'var(--bg-elevated)',
                    padding: '20px',
                    borderRadius: '12px',
                    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                    fontSize: '12px',
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    lineHeight: '1.8',
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--border) transparent',
                    position: 'relative'
                }}>
                {filteredLogs.length === 0 ? (
                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '50px', opacity: 0.5 }}>- No logs to display -</div>
                ) : (
                    <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                            <LogLine
                                key={virtualItem.index}
                                log={filteredLogs[virtualItem.index]}
                                virtualItem={virtualItem}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
