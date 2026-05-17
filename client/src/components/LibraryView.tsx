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
    FFMPEG_AVAILABLE?: boolean;
}

interface DuplicateGroup {
    id: number;
    files: { path: string; size: number; quality: number }[];
    matchType: string;
    recommendation: string;
}

interface UpgradeCandidate {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    quality: number;
    qualityLabel?: string;
    albumId?: string;
    coverUrl?: string;
    duration?: number;
    releaseDate?: string;
    matchScore?: number;
    variantWarning?: boolean;
}

interface UpgradeableFile {
    id?: number;
    filePath: string;
    title: string;
    artist: string;
    album: string;
    quality: number;
    availableQuality: number;
    trackId: string;
    upgradeCandidates: UpgradeCandidate[];
}


interface MissingMetadataFile {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    missingTags?: string[];
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

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value as T[] : []);

const parseMissingTags = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value !== 'string' || value.trim() === '') return [];

    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
    }

    return value
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
};

const normalizeDuplicate = (raw: any): DuplicateGroup => {
    const files = asArray<{ path: string; size: number; quality: number }>(raw?.files);
    const fallbackFiles = [raw?.file_path_1, raw?.file_path_2]
        .filter((path): path is string => typeof path === 'string' && path.length > 0)
        .map((path) => ({ path, size: 0, quality: 0 }));

    return {
        id: Number(raw?.id || 0),
        files: files.length > 0 ? files : fallbackFiles,
        matchType: String(raw?.matchType || raw?.match_type || 'duplicate'),
        recommendation: String(raw?.recommendation || '')
    };
};

const normalizeUpgradeCandidate = (raw: any): UpgradeCandidate => ({
    trackId: String(raw?.trackId || raw?.track_id || raw?.id || ''),
    title: String(raw?.title || ''),
    artist: String(raw?.artist || ''),
    album: String(raw?.album || ''),
    quality: Number(raw?.quality || raw?.availableQuality || raw?.available_quality || 0),
    qualityLabel: raw?.qualityLabel ? String(raw.qualityLabel) : undefined,
    albumId: raw?.albumId ? String(raw.albumId) : undefined,
    coverUrl: raw?.coverUrl ? String(raw.coverUrl) : undefined,
    duration: raw?.duration ? Number(raw.duration) : undefined,
    releaseDate: raw?.releaseDate ? String(raw.releaseDate) : undefined,
    matchScore: raw?.matchScore !== undefined ? Number(raw.matchScore) : undefined,
    variantWarning: Boolean(raw?.variantWarning)
});

const normalizeUpgradeable = (raw: any): UpgradeableFile => {
    const fallbackTrackId = String(raw?.trackId || raw?.track_id || raw?.id || '');
    const fallbackQuality = Number(raw?.availableQuality || raw?.available_quality || raw?.quality || 0);
    const candidates = asArray(raw?.upgradeCandidates || raw?.upgrade_candidates)
        .map(normalizeUpgradeCandidate)
        .filter((candidate) => candidate.trackId && candidate.quality > 0);

    return {
        id: raw?.id,
        filePath: String(raw?.filePath || raw?.file_path || ''),
        title: String(raw?.title || ''),
        artist: String(raw?.artist || ''),
        album: String(raw?.album || ''),
        quality: Number(raw?.quality || 0),
        availableQuality: fallbackQuality,
        trackId: fallbackTrackId,
        upgradeCandidates: candidates.length > 0 && candidates[0]?.trackId
            ? candidates
            : fallbackTrackId
              ? [
                    {
                        trackId: fallbackTrackId,
                        title: String(raw?.title || ''),
                        artist: String(raw?.artist || ''),
                        album: String(raw?.album || ''),
                        quality: fallbackQuality,
                        qualityLabel: QUALITY_LABELS[fallbackQuality] || String(fallbackQuality),
                        matchScore: 1,
                        variantWarning: false
                    }
                ]
              : []
    };
};

const normalizeMissingMetadata = (raw: any): ProcessingFile => ({
    filePath: String(raw?.filePath || raw?.file_path || ''),
    title: String(raw?.title || ''),
    artist: String(raw?.artist || ''),
    album: raw?.album ? String(raw.album) : undefined,
    missingTags: parseMissingTags(raw?.missingTags || raw?.missing_tags),
    status: 'pending'
});

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
    const [loading, setLoading] = useState(false);
    const [upgradingIds, setUpgradingIds] = useState<Set<string>>(new Set());

    const { showToast } = useToast();

    const loadStatus = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/scan/status');
            if (res && res.ok) {
                const data = await res.json();
                setStats(data.stats || data);
                setScanning(Boolean(data.scanning));
                if (data.FFMPEG_AVAILABLE !== undefined) {
                    setStats(prev => ({ ...prev!, FFMPEG_AVAILABLE: data.FFMPEG_AVAILABLE }));
                }
            }
        } catch (e) { console.error(e); }
    }, []);

    const loadDuplicates = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/duplicates');
            if (res && res.ok) {
                const data = await res.json();
                setDuplicates(asArray(data).map(normalizeDuplicate));
            }
        } catch (e) { console.error(e); }
    }, []);

    const loadUpgradeable = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/upgradeable');
            if (res && res.ok) {
                const data = await res.json();
                setUpgradeable(asArray(data).map(normalizeUpgradeable));
            }
        } catch (e) { console.error(e); }
    }, []);

    const loadMissingMetadata = useCallback(async () => {
        try {
            const res = await smartFetch('/api/library/missing-metadata');
            if (res && res.ok) {
                const data = await res.json();
                setMissingMetadata(asArray(data).map(normalizeMissingMetadata));
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

    useEffect(() => {
        setLoading(true);
        loadStatus().finally(() => setLoading(false));
    }, [loadStatus]);

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

    const upgradeTrack = async (track: UpgradeableFile, candidate: UpgradeCandidate) => {
        const queueKey = `${track.filePath}:${candidate.trackId}`;
        setUpgradingIds(prev => new Set(prev).add(queueKey));
        try {
            const res = await smartFetch('/api/queue/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'track',
                    id: candidate.trackId,
                    quality: candidate.quality,
                    metadata: {
                        isUpgrade: true,
                        oldFilePath: track.filePath,
                        selectedUpgradeTitle: candidate.title,
                        selectedUpgradeAlbum: candidate.album
                    }
                })
            });
            if (res && res.ok) {
                showToast(t('toast_upgrade_queued') || 'Added to download queue', 'success');
            } else {
                showToast(t('toast_upgrade_failed') || 'Failed to queue upgrade', 'error');
                setUpgradingIds(prev => { const s = new Set(prev); s.delete(queueKey); return s; });
            }
        } catch {
            showToast(t('toast_upgrade_failed') || 'Failed to queue upgrade', 'error');
            setUpgradingIds(prev => { const s = new Set(prev); s.delete(queueKey); return s; });
        }
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

    const getStatusLabel = (file: ProcessingFile) => {
        if (file.status !== 'pending') return file.status;

        if (file.missingTags && file.missingTags.length > 0) {
            return `Missing ${file.missingTags.join(', ')}`;
        }

        const missing = [];
        if (!file.artist || file.artist === 'Unknown') missing.push('Artist');
        if (!file.album || file.album === 'Unknown') missing.push('Album');
        if (!file.title) missing.push('Title');

        if (missing.length > 0) return `Missing ${missing.join(', ')}`;
        return 'Incomplete Tags';
    };

    const formatMatchScore = (score?: number) => {
        if (score === undefined || Number.isNaN(score)) return '';
        return `${Math.round(Math.max(0, Math.min(1, score)) * 100)}%`;
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds || seconds <= 0) return '';
        const minutes = Math.floor(seconds / 60);
        const remainder = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${minutes}:${remainder}`;
    };

    const progress = scanning
        ? (stats && stats.totalFiles > 0 && stats.processedFiles !== undefined)
            ? Math.min(100, Math.round((stats.processedFiles / stats.totalFiles) * 100))
            : 0
        : (stats && stats.totalFiles > 0) ? 100 : 0;

    if (loading && !stats) {
        return (
            <div id="view-library" className="view-section active">
                <div className="library-header">
                    <div className="skeleton skeleton-text" style={{ width: '250px', height: '28px' }}></div>
                    <div className="library-actions">
                        <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '10px' }}></div>
                        <div className="skeleton" style={{ width: '100px', height: '40px', borderRadius: '10px' }}></div>
                    </div>
                </div>

                <div className="scan-status-card">
                    <div className="skeleton skeleton-text medium"></div>
                    <div className="skeleton" style={{ height: '10px', width: '100%', borderRadius: '5px' }}></div>
                </div>

                <div className="library-stats-grid">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="stat-card">
                            <div className="skeleton skeleton-text short"></div>
                            <div className="skeleton skeleton-text" style={{ height: '32px', width: '50%' }}></div>
                        </div>
                    ))}
                </div>

                <div className="library-tabs" style={{ display: 'flex', gap: '10px', marginTop: '30px' }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="skeleton" style={{ width: '140px', height: '44px', borderRadius: '12px' }}></div>
                    ))}
                </div>
            </div>
        );
    }

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

            {stats && stats.FFMPEG_AVAILABLE === false && (
                <div style={{
                    padding: '12px 16px',
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid #ffc107',
                    borderRadius: '8px',
                    color: '#ffc107',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '0.9em'
                }}>
                    <span style={{ fontSize: '1.2em' }}>⚠️</span>
                    <div>
                        <strong>FFmpeg Not Found:</strong> Quality scanning is disabled. Results will show as "skipped" or 0% confidence.
                        Please install FFmpeg to enable accurate lossless verification.
                    </div>
                </div>
            )}

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
                        <div className="upgrade-choice-list">
                            {upgradeable.map((file, i) => (
                                <section className="upgrade-choice-item" key={file.id || `${file.filePath}-${i}`}>
                                    <div className="upgrade-source-row">
                                        <div>
                                            <div className="track-title">{file.title || getFilename(file.filePath)}</div>
                                            <div className="track-artist">{file.artist}</div>
                                            <div className="upgradeable-path">{getFilename(file.filePath)}</div>
                                        </div>
                                        <div className="upgradeable-quality">
                                            <span className="current-quality">{QUALITY_LABELS[file.quality] || file.quality}</span>
                                            <span className="upgrade-arrow">-&gt;</span>
                                            <span className="available-quality">{file.upgradeCandidates.length} {t('label_upgrade_options') || 'options'}</span>
                                        </div>
                                    </div>

                                    <div className="upgrade-candidate-grid">
                                        {file.upgradeCandidates.map((candidate) => {
                                            const queueKey = `${file.filePath}:${candidate.trackId}`;
                                            const queued = upgradingIds.has(queueKey);
                                            const qualityLabel = candidate.qualityLabel || QUALITY_LABELS[candidate.quality] || candidate.quality;
                                            return (
                                                <article className="upgrade-candidate-card" key={candidate.trackId}>
                                                    {candidate.coverUrl ? (
                                                        <img className="upgrade-candidate-cover" src={candidate.coverUrl} alt="" />
                                                    ) : (
                                                        <div className="upgrade-candidate-cover fallback"><Icons.Library width={22} height={22} /></div>
                                                    )}
                                                    <div className="upgrade-candidate-main">
                                                        <div className="upgrade-candidate-title">{candidate.title || file.title}</div>
                                                        <div className="upgrade-candidate-meta">{candidate.artist || file.artist}</div>
                                                        <div className="upgrade-candidate-album">{candidate.album || t('label_unknown_album') || 'Unknown Album'}</div>
                                                        <div className="upgrade-candidate-tags">
                                                            <span className="quality-badge high-res">{qualityLabel}</span>
                                                            {candidate.releaseDate && <span className="candidate-chip">{candidate.releaseDate}</span>}
                                                            {formatDuration(candidate.duration) && <span className="candidate-chip">{formatDuration(candidate.duration)}</span>}
                                                            {formatMatchScore(candidate.matchScore) && <span className="candidate-chip">{t('label_match') || 'Match'} {formatMatchScore(candidate.matchScore)}</span>}
                                                            {candidate.variantWarning && <span className="candidate-chip warning">{t('label_variant') || 'Variant'}</span>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        className="btn small primary upgrade-candidate-action"
                                                        onClick={() => upgradeTrack(file, candidate)}
                                                        disabled={queued}
                                                        title={queued ? 'Queued for download' : 'Download this Hi-Res version'}
                                                        style={queued ? { opacity: 0.6, cursor: 'default' } : {}}
                                                    >
                                                        <Icons.Download width={12} height={12} /> {queued ? t('label_queued') || 'Queued' : t('action_upgrade')}
                                                    </button>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
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
                                The following files are missing metadata, cover art, or lyrics. Click "Auto-Fix All" to identify and tag them using Smart Match.
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
                                                    {getStatusLabel(file)}
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
