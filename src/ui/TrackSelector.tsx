import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Track } from '../types/qobuz.js';

interface Props {
    tracks: Track[];
    onSubmit: (selectedIndices: number[]) => void;
    onCancel?: () => void;
}

const TrackSelector: React.FC<Props> = ({ tracks, onSubmit, onCancel }) => {
    const [cursor, setCursor] = useState(0);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const visibleHeight = 15;
    const startIdx = Math.max(0, Math.min(cursor - 5, tracks.length - visibleHeight));
    const endIdx = Math.min(startIdx + visibleHeight, tracks.length);
    const visibleTracks = tracks.slice(startIdx, endIdx);
    const [ready, setReady] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);

    React.useEffect(() => {
        const timer = setTimeout(() => setReady(true), 1000);
        return () => clearTimeout(timer);
    }, []);

    useInput((input, key) => {
        if (!ready) return;

        if (warning) setWarning(null);

        if (key.upArrow) {
            setCursor(prev => Math.max(0, prev - 1));
        }
        if (key.downArrow) {
            setCursor(prev => Math.min(tracks.length - 1, prev + 1));
        }
        if (input === ' ') {
            const newSelected = new Set(selected);
            if (newSelected.has(cursor)) newSelected.delete(cursor);
            else newSelected.add(cursor);
            setSelected(newSelected);
        }
        if (input === 'a') {
            if (selected.size === tracks.length) setSelected(new Set());
            else setSelected(new Set(tracks.map((_, i) => i)));
        }
        if (key.return) {
            if (selected.size === 0) {
                setWarning('⚠️ Please select at least one track!');
            } else {
                onSubmit(Array.from(selected).sort((a, b) => a - b));
            }
        }
        if (key.escape && onCancel) {
            onCancel();
        }
    });

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
            <Text bold color="cyan">Select tracks to download:</Text>
            <Text color="gray">↑/↓: Move | Space: Toggle | 'a': Toggle All | Enter: Confirm</Text>
            {warning && <Text color="yellow" bold>{warning}</Text>}
            <Box flexDirection="column" marginTop={1}>
                {visibleTracks.map((t, i) => {
                    const realIndex = startIdx + i;
                    const isSelected = selected.has(realIndex);
                    const isFocused = realIndex === cursor;
                    const label = `${(realIndex + 1).toString().padStart(2, '0')}. ${t.title}`;

                    return (
                        <Box key={realIndex}>
                            <Text color={isFocused ? 'cyan' : 'white'}>
                                {isFocused ? '> ' : '  '}
                                {isSelected ? '[x] ' : '[ ] '}
                                {label}
                            </Text>
                        </Box>
                    );
                })}
            </Box>
            <Box marginTop={1}>
                <Text color="gray">Selected: {selected.size}/{tracks.length} tracks</Text>
            </Box>
        </Box>
    );
};

export default TrackSelector;
