import React, { useEffect, useState, useCallback } from 'react';
import { smartFetch } from '../utils/api';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './Icons';

interface LibraryStats {
    totalFiles: number;
    duplicates: number;
    upgradeable: number;
    totalSize: number;
    processedFiles?: number;
    missingMetadata?: number;
}

interface DuplicateGroup {
    id: number;
    files: { path: string; size: number; quality: number }[];
    matchType: string;
    recommendation: string;
}

interface UpgradeableFile {
    id: number;
    file_path: string;
    title: string;
    artist: string;
    album: string;
    quality: number;
    available_quality: number;
    track_id: string;
}


interface MissingMetadataFile {
    filePath: string;
    title: string;
    artist: string;
}

interface ProcessingFile extends MissingMetadataFile {
    status: 'pending' | 'identifying' | 'found' | 'not_found' | 'applied';
    result?: any;
}

const QUALITY_LABELS: Record<number, string> = {
    5: 'MP3 320',
    6: 'FLAC 16/44.1',
    7: 'FLAC 24/96',
    27: 'FLAC 24/192'
};

export const LibraryView: React.FC = () => {
    const { socket } = useSocket();
    const { t } = useLanguage();
    const [stats, setStats] = useState<LibraryStats | null>(null);
    const [scanning, setScanning] = useState(false);
    const [activeTab, setActiveTab] = useState<'duplicates' | 'upgradeable' | 'metadata'>('duplicates');

    const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
    const [upgradeable, setUpgradeable] = useState<UpgradeableFile[]>([]);
    const [missingMetadata, setMissingMetadata] = useState<ProcessingFile[]>([]);
    const [processingMetadata, setProcessingMetadata] = useState(false);

    const { showToast } = useToast();

    const loadStatus = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/scan/status');
            if (res && res.ok) {
                const data = await res.json();
                setStats(data.stats);
                setScanning(data.scanning);
            }
        } catch (e) { console.error(e); }
    }, []);

    const loadDuplicates = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/duplicates');
            if (res && res.ok) setDuplicates(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    const loadUpgradeable = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/upgradeable');
            if (res && res.ok) setUpgradeable(await res.json());
        } catch (e) { console.error(e); }
    }, []);

    const loadMissingMetadata = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/missing-metadata');
            if (res && res.ok) {
                const data = await res.json();
                setMissingMetadata(data.map((f: any) => ({ ...f, status: 'pending' })));
            }
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => {
        if (!socket) return;
        const handleScanProgress = (data: any) => {
            setStats(prev => ({
                ...prev || { totalFiles: 0, duplicates: 0, upgradeable: 0, totalSize: 0, missingMetadata: 0 },
                totalFiles: data.total,
                processedFiles: data.current
            }));
            setScanning(true);
        };
        const handleScanComplete = () => {
            setScanning(false);
            loadStatus();
            loadDuplicates();
            loadUpgradeable();
            loadMissingMetadata();
            showToast('Scan complete!', 'success');
        };

        socket.on('scan:progress', handleScanProgress);
        socket.on('scan:complete', handleScanComplete);
        return () => {
            socket.off('scan:progress', handleScanProgress);
            socket.off('scan:complete', handleScanComplete);
        };
    }, [socket, loadStatus, loadDuplicates, loadUpgradeable, loadMissingMetadata, showToast]);

    useEffect(() => { loadStatus(); }, [loadStatus]);

    useEffect(() => {
        if (activeTab === 'duplicates') loadDuplicates();
        if (activeTab === 'upgradeable') loadUpgradeable();
        if (activeTab === 'metadata') loadMissingMetadata();
    }, [activeTab, loadDuplicates, loadUpgradeable, loadMissingMetadata]);

    const startScan = async () => {
        try {
            setScanning(true);
            await smartFetch('/api/library/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            showToast('Scan started', 'success');
        } catch (e) {
            setScanning(false);
            showToast('Error starting scan', 'error');
        }
    };

    const abortScan = async () => {
        await smartFetch('/api/library/scan/abort', { method: 'POST' });
        showToast('Stopping scan...', 'info');
    };

    const resolveDuplicate = async (id: number) => {
        const res = await smartFetch(`/api/library/duplicates/${id}/resolve`, { method: 'POST' });
        if (res && res.ok) {
            showToast('Duplicate resolved', 'success');
            loadDuplicates();
            loadStatus();
        }
    };

    const upgradeTrack = async (track: UpgradeableFile) => {
        await smartFetch('/api/queue/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'track',
                id: track.track_id,
                quality: track.available_quality
            })
        });
        showToast('Added to queue for upgrade', 'success');
    };

    const processMetadata = async () => {
        if (processingMetadata) return;
        setProcessingMetadata(true);
        const files = [...missingMetadata];

        for (let i = 0; i < files.length; i++) {
            if (files[i].status === 'applied') continue;

            files[i].status = 'identifying';
            setMissingMetadata([...files]);


            try {
                const idRes = await smartFetch('/api/tools/identify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: files[i].filePath })
                });

                if (idRes && idRes.ok) {
                    const data = await idRes.json();
                    files[i].result = data.data;
                    files[i].status = 'found';
                    setMissingMetadata([...files]);

                    const applyRes = await smartFetch('/api/tools/apply-metadata', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: files[i].filePath, metadata: data.data })
                    });

                    if (applyRes && applyRes.ok) {
                        files[i].status = 'applied';
                        files[i].title = data.data.title;
                        files[i].artist = data.data.artist;
                    }
                } else {
                    files[i].status = 'not_found';
                }
            } catch (e) {
                files[i].status = 'not_found';
            }
            setMissingMetadata([...files]);
        }
        setProcessingMetadata(false);
        showToast('Metadata processing complete', 'success');
    };


    const getFilename = (path: string | undefined | null) => {
        if (!path) return 'Unknown File';
        const parts = path.split(/[/\\]/);
        if (parts.length >= 2) {
            return `${parts[parts.length - 2]} / ${parts[parts.length - 1]}`;
        }
        return parts.pop() || path;
    };

    const progress = scanning
        ? (stats && stats.totalFiles > 0 && stats.processedFiles !== undefined)
            ? Math.min(100, Math.round((stats.processedFiles / stats.totalFiles) * 100))
            : 0
        : (stats && stats.totalFiles > 0) ? 100 : 0;

    return (
        <div id="view-library" className="view-section active">
            <div className="library-header">
                <h3>📚 {t('title_library')} Scanner</h3>
                <div className="library-actions">
                    <button className="btn primary" onClick={startScan} disabled={scanning} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {scanning ? <>{t('msg_scanning')}</> : <><Icons.Search width={14} height={14} /> {t('action_scan')}</>}
                    </button>
                    <button className="btn secondary" onClick={abortScan} disabled={!scanning} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icons.Stop width={14} height={14} /> {t('action_stop')}
                    </button>
                </div>
            </div>

            <div id="scan-status" className="scan-status-card">
                <div className="scan-indicator">
                    <span id="scan-status-icon">{scanning ? '🔄' : '⏸'}</span>
                    <span id="scan-status-text">
                        {scanning ? `${t('msg_scanning')} ${stats?.processedFiles || 0}/${stats?.totalFiles || 0}` : t('msg_not_scanning')}
                    </span>
                </div>
                <div className="scan-progress-container">
                    <progress id="scan-progress" value={progress} max="100"></progress>
                    <span id="scan-percentage">{progress}%</span>
                </div>
            </div>

            <div className="library-stats-grid">
                <div className="stat-card">
                    <h3>{t('label_total_files')}</h3>
                    <div className="number">{stats?.totalFiles || 0}</div>
                </div>
                <div className="stat-card">
                    <h3>{t('label_duplicates')}</h3>
                    <div className="number text-warning">{stats?.duplicates || 0}</div>
                </div>
                <div className="stat-card">
                    <h3>{t('label_hires')}</h3>
                    <div className="number text-accent">{stats?.upgradeable || 0}</div>
                </div>
                <div className="stat-card">
                    <h3>Missing Tags</h3>
                    <div className="number" style={{ color: 'var(--danger)' }}>{missingMetadata.length || stats?.missingMetadata || 0}</div>
                </div>
            </div>

            <div className="library-tabs">
                <button className={`tab-btn ${activeTab === 'duplicates' ? 'active' : ''}`} onClick={() => setActiveTab('duplicates')}>
                    ⚠️ {t('tab_duplicates')} {duplicates.length > 0 && `(${duplicates.length})`}
                </button>
                <button className={`tab-btn ${activeTab === 'upgradeable' ? 'active' : ''}`} onClick={() => setActiveTab('upgradeable')}>
                    🎧 {t('tab_upgradeable')} {upgradeable.length > 0 && `(${upgradeable.length})`}
                </button>
                <button className={`tab-btn ${activeTab === 'metadata' ? 'active' : ''}`} onClick={() => setActiveTab('metadata')}>
                    🏷️ Metadata Issues {missingMetadata.length > 0 && `(${missingMetadata.length})`}
                </button>
            </div>

            {/* Duplicates Tab */}
            <div className={`library-tab-content ${activeTab === 'duplicates' ? 'active' : ''}`} style={{ display: activeTab === 'duplicates' ? 'block' : 'none' }}>
                <div className="duplicates-list">
                    {duplicates.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">✅</div>
                            <h3>{t('msg_no_results')}</h3>
                            <p>No duplicates found.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Files</th>
                                        <th>Match Type</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {duplicates.map((dup) => (
                                        <tr key={dup.id}>
                                            <td className="duplicate-files">
                                                {dup.files.map((f, idx) => (
                                                    <div key={idx} className="file-path">📁 {getFilename(f.path)}</div>
                                                ))}
                                            </td>
                                            <td><span className="badge">{dup.matchType}</span></td>
                                            <td>
                                                <button className="btn small secondary" onClick={() => resolveDuplicate(dup.id)}>
                                                    <Icons.Resolve width={12} height={12} /> {t('action_resolve')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Upgradeable Tab */}
            <div className={`library-tab-content ${activeTab === 'upgradeable' ? 'active' : ''}`} style={{ display: activeTab === 'upgradeable' ? 'block' : 'none' }}>
                <div className="upgradeable-list">
                    {upgradeable.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">✅</div>
                            <h3>No Upgrades Available</h3>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr><th>Track</th><th>Current</th><th>Available</th><th>Action</th></tr>
                                </thead>
                                <tbody>
                                    {upgradeable.map((file, i) => (
                                        <tr key={file.id || i}>
                                            <td>
                                                <div className="track-title">{file.title || getFilename(file.file_path)}</div>
                                                <div className="track-artist">{file.artist}</div>
                                            </td>
                                            <td><span className="quality-badge">{QUALITY_LABELS[file.quality] || file.quality}</span></td>
                                            <td><span className="quality-badge high-res">{QUALITY_LABELS[file.available_quality] || file.available_quality}</span></td>
                                            <td>
                                                <button className="btn small primary" onClick={() => upgradeTrack(file)}>
                                                    <Icons.Download width={12} height={12} /> {t('action_upgrade')}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Metadata Tab */}
            <div className={`library-tab-content ${activeTab === 'metadata' ? 'active' : ''}`} style={{ display: activeTab === 'metadata' ? 'block' : 'none' }}>
                <div className="metadata-list">
                    {missingMetadata.length > 0 && (
                        <div className="library-header" style={{ marginBottom: '20px' }}>
                            <p className="section-desc">
                                The following files are missing Title or Artist tags. Click "Auto-Fix All" to identify and tag them using Smart Match.
                            </p>
                            <button
                                className="btn primary"
                                onClick={processMetadata}
                                disabled={processingMetadata}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                {processingMetadata ? 'Processing...' : <><Icons.Check width={14} height={14} /> Auto-Fix All ({missingMetadata.length})</>}
                            </button>
                        </div>
                    )}

                    {missingMetadata.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">✅</div>
                            <h3>All Tags Look Good</h3>
                            <p>No missing metadata found in your library.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="data-table">
                                <thead>
                                    <tr><th>File</th><th>Current Status</th><th>Result</th></tr>
                                </thead>
                                <tbody>

                                    {missingMetadata.map((file, i) => (
                                        <tr key={i}>
                                            <td>
                                                <div className="file-path">{getFilename(file.filePath)}</div>
                                                <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>
                                                    {file.filePath}
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`badge ${file.status === 'applied' ? 'success' :
                                                    file.status === 'not_found' ? 'error' :
                                                        file.status === 'identifying' ? 'info' : 'warning'
                                                    }`}>
                                                    {file.status === 'pending' ? 'Missing Tags' : file.status}
                                                </span>
                                            </td>
                                            <td>
                                                {file.result ? (
                                                    <div className="track-info">
                                                        <span style={{ fontWeight: 600 }}>{file.result.title}</span>
                                                        <span style={{ opacity: 0.8 }}> - {file.result.artist}</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};