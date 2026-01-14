import React, { useState, useEffect } from 'react';
import { EventEmitter } from 'events';
import DownloadDashboard, { DownloadItemState } from './DownloadDashboard.js';

interface Props {
    emitter: EventEmitter;
    title: string;
    totalTracks: number;
}

const DownloadManagerUI: React.FC<Props> = ({ emitter, title, totalTracks }) => {
    const [items, setItems] = useState<DownloadItemState[]>([]);
    const [completedIds] = useState(new Set<string>());
    const [, forceUpdate] = useState({});

    useEffect(() => {
        const handleUpdate = (data: { id: string; state: Partial<DownloadItemState> }) => {
            const { id, state } = data;

            if (state.status === 'done' || state.status === 'failed') {
                if (!completedIds.has(id)) {
                    completedIds.add(id);
                    forceUpdate({});
                }
            }

            setItems((prev) => {
                const idx = prev.findIndex(i => i.id === id);
                if (idx === -1) {
                    if (!state.id) return prev;
                    return [...prev, { ...state as DownloadItemState }];
                }
                const newItems = [...prev];
                newItems[idx] = { ...newItems[idx], ...state };
                return newItems;
            });
        };

        emitter.on('update', handleUpdate);

        return () => {
            emitter.off('update', handleUpdate);
        };
    }, [emitter, completedIds]);

    const completedCount = completedIds.size;

    return (
        <DownloadDashboard
            items={items}
            title={title}
            completedCount={completedCount}
            totalCount={totalTracks}
        />
    );
};

export default DownloadManagerUI;
