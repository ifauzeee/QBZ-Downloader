import React from 'react';
import { Box, Text } from 'ink';
import ProgressBar from './ProgressBar.js';
import Spinner from 'ink-spinner';

export interface DownloadItemState {
    id: string;
    filename: string;
    totalBytes: number;
    downloadedBytes: number;
    status: 'pending' | 'downloading' | 'processing' | 'done' | 'failed';
    phase: string;
    error?: string;
    speed?: number;
}

interface Props {
    items: DownloadItemState[];
    title: string;
    completedCount: number;
    totalCount: number;
}

const formatBytes = (bytes: number | undefined) => {
    if (bytes === undefined || isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
    return (isNaN(val) ? '0' : val) + ' ' + (sizes[i] || 'B');
};

const DownloadDashboard: React.FC<Props> = ({ items, title, completedCount, totalCount }) => {
    const activeItems = items.filter(
        i => i.status === 'downloading' || i.status === 'processing'
    );

    const overallPercent = totalCount > 0 ? completedCount / totalCount : 0;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" padding={1}>
            <Box flexDirection="row" justifyContent="space-between" marginBottom={1}>
                <Box flexDirection="column">
                    <Text bold color="cyan">📥 {title}</Text>
                    <Box flexDirection="row" marginTop={0}>
                        {totalCount > 1 && (
                            <>
                                <Box width={20}>
                                    <ProgressBar percent={overallPercent} color="cyan" width={20} />
                                </Box>
                                <Box marginLeft={1}>
                                    <Text color="gray">{completedCount}/{totalCount} tracks</Text>
                                </Box>
                            </>
                        )}
                        {totalCount <= 1 && (
                            <Text color="gray">Single Track Download</Text>
                        )}
                    </Box>
                </Box>
            </Box>

            <Box flexDirection="column">
                {activeItems.length === 0 && completedCount < totalCount && (
                    <Text color="gray">Initializing downloads...</Text>
                )}
                {activeItems.map((item) => {
                    const percent = item.totalBytes > 0 ? item.downloadedBytes / item.totalBytes : 0;

                    return (
                        <Box key={item.id} flexDirection="column" marginBottom={1} borderStyle="single" borderColor="gray" paddingX={1}>
                            <Box flexDirection="row" justifyContent="space-between">
                                <Text bold color="white">{item.filename}</Text>
                                <Text color={item.status === 'processing' ? 'blue' : 'green'}>{item.phase}</Text>
                            </Box>
                            {item.status === 'downloading' ? (
                                <Box flexDirection="row" alignItems="center">
                                    <Box width={30}>
                                        <ProgressBar percent={percent} color="green" />
                                    </Box>
                                    <Box width={5} marginLeft={1}>
                                        <Text>{Math.round(percent * 100)}%</Text>
                                    </Box>
                                    <Box width={22}>
                                        <Text>{formatBytes(item.downloadedBytes)} / {formatBytes(item.totalBytes)}</Text>
                                    </Box>
                                    {item.speed !== undefined && (
                                        <Box width={14}>
                                            <Text color="yellow">⚡ {formatBytes(item.speed)}/s</Text>
                                        </Box>
                                    )}
                                </Box>
                            ) : (
                                <Box flexDirection="row">
                                    <Text color="blue"><Spinner type="dots" /> Processing...</Text>
                                </Box>
                            )}
                        </Box>
                    )
                })}
            </Box>
        </Box>
    );
};

export default DownloadDashboard;
