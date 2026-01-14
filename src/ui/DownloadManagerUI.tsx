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
    const [completedCount, setCompletedCount] = useState(0);

    useEffect(() => {
        const handleUpdate = (data: { id: string; state: Partial<DownloadItemState> }) => {
            setItems((prev) => {
                const idx = prev.findIndex(i => i.id === data.id);
                if (idx === -1) {
                    if (!data.state.id) return prev;
                    return [...prev, { ...data.state as DownloadItemState }];
                }
                const newItems = [...prev];
                newItems[idx] = { ...newItems[idx], ...data.state };

                return newItems;
            });
        };

        const handleComplete = () => {
            setCompletedCount(c => c + 1);
        };

        emitter.on('update', handleUpdate);
        emitter.on('track_complete', handleComplete);

        return () => {
            emitter.off('update', handleUpdate);
            emitter.off('track_complete', handleComplete);
        };
    }, [emitter]);

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
