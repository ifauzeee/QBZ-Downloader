import React, { useState } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { Icons } from './Icons';
import { ConfirmModal } from './Modals';

export const BatchImportView: React.FC = () => {
    const { showToast } = useToast();

    const [directInput, setDirectInput] = useState('');
    const [quality, setQuality] = useState(27);
    const [importing, setImporting] = useState(false);

    const [mode, setMode] = useState<'file' | 'm3u8' | 'csv' | 'direct'>('direct');
    const [stagedCount, setStagedCount] = useState(0);
    const [createZip, setCreateZip] = useState(false);

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<{ name: string, count: number } | null>(null);
    const [parsedUrls, setParsedUrls] = useState<string[]>([]);

    React.useEffect(() => {
        const staged = localStorage.getItem('batch_staging_urls');
        if (staged) {
            const lines = staged.split('\n').filter(l => l.trim());
            setStagedCount(lines.length);

            if (!directInput && lines.length > 0 && mode === 'direct') {
                setDirectInput(staged);
                showToast(`Auto-loaded ${lines.length} items from staging`, 'success');
            }
        } else {
            setStagedCount(0);
        }

        if (mode !== 'direct') {
            setSelectedFile(null);
            setParsedUrls([]);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }, [mode]);

    const parseFileContent = (content: string, type: 'file' | 'm3u8' | 'csv') => {
        const lines = content.split(/\r?\n/);
        let urls: string[] = [];

        if (type === 'csv') {
            const allText = content;
            const matches = allText.match(/https?:\/\/(open\.qobuz\.com|www\.qobuz\.com)\/[a-zA-Z0-9\/_-]+/g);
            if (matches) {
                urls = Array.from(new Set(matches));
            }
        } else {
            urls = lines
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('#') && l.includes('qobuz.com'));
        }

        return urls;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                const urls = parseFileContent(content, mode as any);
                setParsedUrls(urls);
                setSelectedFile({ name: file.name, count: urls.length });
                if (urls.length === 0) {
                    showToast('No Qobuz URLs found in file', 'info');
                } else {
                    showToast(`Found ${urls.length} URLs`, 'success');
                }
            }
        };
        reader.readAsText(file);
    };

    const handleImport = async () => {
        let urlsToImport: string[] = [];

        if (mode === 'direct') {
            urlsToImport = directInput.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
            if (urlsToImport.length === 0) {
                showToast('Please enter at least one URL', 'error');
                return;
            }
        } else {
            if (!selectedFile || parsedUrls.length === 0) {
                showToast('Please select a valid file with URLs', 'error');
                return;
            }
            urlsToImport = parsedUrls;
        }

        setImporting(true);
        try {
            const res = await smartFetch('/api/batch/import/direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: urlsToImport, quality, createZip })
            });

            if (res && res.ok) {
                const result = await res.json();
                if (result.success) {
                    showToast(`Imported ${result.imported} URLs!`, 'success');

                    if (mode === 'direct') {
                        setDirectInput('');
                        if (localStorage.getItem('batch_staging_urls')) {
                            localStorage.removeItem('batch_staging_urls');
                            setStagedCount(0);
                        }
                    } else {
                        setSelectedFile(null);
                        setParsedUrls([]);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }
                } else {
                    showToast(`Partial success: ${result.imported} imported, ${result.failed} failed`, 'info');
                }
            } else {
                const data = await res?.json();
                showToast(data?.error || 'Import failed', 'error');
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setImporting(false);
        }
    };

    const loadFromStaging = () => {
        const staged = localStorage.getItem('batch_staging_urls');
        if (staged) {
            const current = directInput ? directInput + (directInput.endsWith('\n') ? '' : '\n') : '';
            setDirectInput(current + staged);
            const lines = staged.split('\n').filter(l => l.trim());
            showToast(`Loaded ${lines.length} URLs from Staging`, 'success');
        } else {
            showToast('No staged URLs found', 'info');
        }
    };


    const [showConfirmClear, setShowConfirmClear] = useState(false);

    const clearStaging = () => {
        setShowConfirmClear(true);
    };

    const executeClearStaging = () => {
        localStorage.removeItem('batch_staging_urls');
        setStagedCount(0);
        setDirectInput('');
        showToast('Staging and input cleared', 'success');
        setShowConfirmClear(false);
    };

    const qualityOptions = [
        { value: 5, label: 'MP3', detail: '320kbps' },
        { value: 6, label: 'CD', detail: '16-bit / 44.1kHz' },
        { value: 7, label: 'Hi-Res', detail: '24-bit / 96kHz' },
        { value: 27, label: 'Max', detail: 'Up to 24-bit / 192kHz' },
    ];

    return (
        <div id="view-batch" className="view-section active">
            <div className="batch-grid">

                {/* Top: Mode Selection */}
                <div className="batch-sidebar">
                    <div className="sidebar-group">
                        <div className="sidebar-title">Input Source</div>
                        <div className="modes-grid">
                            <button className={`mode-card ${mode === 'direct' ? 'active' : ''}`} onClick={() => setMode('direct')}>
                                <div className="mode-icon"><Icons.Edit width={18} height={18} /></div>
                                <div className="mode-info">
                                    <span className="mode-name">Direct Input</span>
                                </div>
                            </button>
                            <button className={`mode-card ${mode === 'file' ? 'active' : ''}`} onClick={() => setMode('file')}>
                                <div className="mode-icon"><Icons.File width={18} height={18} /></div>
                                <div className="mode-info">
                                    <span className="mode-name">Text File</span>
                                </div>
                            </button>
                            <button className={`mode-card ${mode === 'm3u8' ? 'active' : ''}`} onClick={() => setMode('m3u8')}>
                                <div className="mode-icon"><Icons.List width={18} height={18} /></div>
                                <div className="mode-info">
                                    <span className="mode-name">Playlist</span>
                                </div>
                            </button>
                            <button className={`mode-card ${mode === 'csv' ? 'active' : ''}`} onClick={() => setMode('csv')}>
                                <div className="mode-icon"><Icons.Grid width={18} height={18} /></div>
                                <div className="mode-info">
                                    <span className="mode-name">CSV Data</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bottom: Configuration & Action */}
                <div className="batch-main">

                    {/* Quality Selector */}
                    <div className="config-section">
                        <label className="section-label">Target Quality</label>
                        <div className="quality-grid">
                            {qualityOptions.map(opt => (
                                <div
                                    key={opt.value}
                                    className={`quality-card ${quality === opt.value ? 'active' : ''}`}
                                    onClick={() => setQuality(opt.value)}
                                >
                                    <div className="quality-label">{opt.label}</div>
                                    <div className="quality-detail">{opt.detail}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Options Section */}
                    <div className="config-section">
                        <label className="section-label">Options</label>
                        <div
                            className={`option-card ${createZip ? 'active' : ''}`}
                            onClick={() => setCreateZip(!createZip)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border)',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                borderColor: createZip ? 'var(--accent)' : 'var(--border)'
                            }}
                        >
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                border: `2px solid ${createZip ? 'var(--accent)' : 'var(--text-secondary)'}`,
                                background: createZip ? 'var(--accent)' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white'
                            }}>
                                {createZip && <Icons.Check width={14} height={14} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Create ZIP Archive</span>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Automatically bundle all files into a single ZIP archive after download</span>
                            </div>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="config-section">
                        <label className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{mode === 'direct' ? 'URL List' : 'Select File'}</span>
                            {mode === 'direct' && (
                                <div className="action-links">
                                    <button className="text-btn" onClick={loadFromStaging} disabled={stagedCount === 0}>
                                        Load Staged {stagedCount > 0 && `(${stagedCount})`}
                                    </button>
                                    <button className="text-btn danger" onClick={clearStaging} disabled={stagedCount === 0 && !directInput}>
                                        Clear
                                    </button>
                                </div>
                            )}
                        </label>

                        {mode === 'direct' ? (
                            <div className="input-wrapper">
                                <textarea
                                    className="custom-textarea"
                                    value={directInput}
                                    onChange={e => setDirectInput(e.target.value)}
                                    placeholder={`https://open.qobuz.com/track/12345\nhttps://open.qobuz.com/album/67890`}
                                    spellCheck={false}
                                />
                                <div className="input-footer">
                                    Supports Tracks, Albums, Artists, Playlists. One URL per line.
                                </div>
                            </div>
                        ) : (
                            <div className="input-wrapper file-selector-wrapper">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                    accept={mode === 'csv' ? '.csv' : mode === 'm3u8' ? '.m3u, .m3u8' : '.txt'}
                                />
                                <div
                                    className="file-drop-card"
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                            if (fileInputRef.current) {
                                                const dT = new DataTransfer();
                                                dT.items.add(e.dataTransfer.files[0]);
                                                fileInputRef.current.files = dT.files;
                                                const event = { target: { files: dT.files } } as any;
                                                handleFileSelect(event);
                                            }
                                        }
                                    }}
                                >
                                    <div className="file-icon-large">
                                        {mode === 'csv' ? <Icons.Grid width={48} height={48} /> :
                                            mode === 'm3u8' ? <Icons.List width={48} height={48} /> :
                                                <Icons.File width={48} height={48} />}
                                    </div>
                                    <div className="file-info-text">
                                        {selectedFile ? (
                                            <>
                                                <div className="selected-filename">{selectedFile.name}</div>
                                                <div className="parsed-count">{selectedFile.count} URLs found</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="upload-prompt">Click to Select {mode.toUpperCase()} File</div>
                                                <div className="upload-sub">or drag and drop here</div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="input-footer">
                                    File will be processed locally. Only URLs are extracted.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <div className="action-section">
                        <button
                            className="start-btn"
                            onClick={handleImport}
                            disabled={importing || (mode === 'direct' ? !directInput.trim() : parsedUrls.length === 0)}
                        >
                            {importing ? (
                                <>Processing <div className="spinner small white"></div></>
                            ) : (
                                <>Start Import <Icons.Download width={20} height={20} /></>
                            )}
                        </button>
                    </div>

                </div>
            </div>

            <style>{`
                .batch-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 32px;
                    max-width: 1100px;
                    margin: 0 auto;
                }
                
                .batch-sidebar {
                    width: 100%;
                }

                .modes-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 16px;
                }
                
                .sidebar-title {
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                    color: var(--text-secondary);
                    font-weight: 800;
                    margin-bottom: 16px;
                    padding-left: 4px;
                }
                
                .mode-card {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 16px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    text-align: left;
                    cursor: pointer;
                    transition: border-color 0.2s, background-color 0.2s;
                }
                
                .mode-card:hover {
                    border-color: var(--accent);
                    background: var(--bg-hover);
                }
                
                .mode-card.active {
                    background: rgba(99, 102, 241, 0.15);
                    border-color: var(--accent);
                }
                
                .mode-icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 32px;
                    height: 32px;
                    background: var(--bg-hover);
                    border-radius: 8px;
                    color: var(--text-secondary);
                }

                .mode-card.active .mode-icon {
                    background: var(--accent);
                    color: white;
                }
                
                .mode-info {
                    display: flex;
                    flex-direction: column;
                }
                
                .mode-name {
                    font-weight: 600;
                    font-size: 14px;
                    color: var(--text-primary);
                }
                
                .config-section {
                    margin-bottom: 32px;
                    animation: slideUp 0.3s ease-out;
                }
                
                .section-label {
                    display: block;
                    font-size: 14px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    color: var(--text-primary);
                }
                
                .quality-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
                
                .quality-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 16px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                
                .quality-card:hover {
                    border-color: var(--accent);
                    background: var(--bg-hover);
                }
                
                .quality-card.active {
                    background: var(--bg-card);
                    border-color: var(--accent);
                    box-shadow: 0 0 0 2px var(--accent);
                }
                
                .quality-label {
                    font-weight: 700;
                    font-size: 16px;
                    margin-bottom: 4px;
                    color: var(--text-primary);
                }
                
                .quality-detail {
                    font-size: 11px;
                    color: var(--text-secondary);
                }
                
                .custom-textarea {
                    width: 100%;
                    height: 350px;
                    padding: 20px;
                    background: var(--bg-input);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    color: var(--text-primary);
                    font-family: 'JetBrains Mono', 'Fira Code', monospace;
                    font-size: 13px;
                    line-height: 1.6;
                    resize: vertical;
                    transition: border-color 0.2s;
                }

                .custom-textarea::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.7;
                }
                
                .custom-textarea:focus {
                    outline: none;
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .custom-input {
                    width: 100%;
                    padding: 16px;
                    background: var(--bg-input);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    color: var(--text-primary);
                    font-size: 14px;
                }

                .custom-input::placeholder {
                    color: var(--text-secondary);
                    opacity: 0.7;
                }
                
                .custom-input:focus {
                    outline: none;
                    border-color: var(--accent);
                }
                
                .input-footer {
                    margin-top: 12px;
                    font-size: 12px;
                    color: var(--text-secondary);
                    text-align: right;
                }
                
                .text-btn {
                    background: none;
                    border: none;
                    color: var(--accent);
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                
                .text-btn:hover:not(:disabled) {
                    background: rgba(99, 102, 241, 0.1);
                }
                
                .text-btn.danger {
                    color: #ef4444;
                }
                
                .text-btn.danger:hover:not(:disabled) {
                    background: rgba(239, 68, 68, 0.1);
                }
                
                .text-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .file-selector-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .file-drop-card {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    padding: 32px;
                    background: var(--bg-input);
                    border: 2px dashed var(--border);
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    min-height: 200px;
                }

                .file-drop-card:hover {
                    border-color: var(--accent);
                    background: var(--bg-hover);
                }

                .file-icon-large {
                    color: var(--accent);
                    opacity: 0.8;
                }

                .file-info-text {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .upload-prompt {
                    font-weight: 600;
                    color: var(--text-primary);
                    font-size: 15px;
                }

                .upload-sub {
                    color: var(--text-secondary);
                    font-size: 13px;
                }

                .selected-filename {
                    font-weight: 700;
                    color: var(--accent);
                    font-size: 15px;
                    word-break: break-all;
                }

                .parsed-count {
                    font-size: 13px;
                    color: var(--text-primary);
                    background: var(--bg-card);
                    padding: 4px 10px;
                    border-radius: 12px;
                    margin-top: 4px;
                    display: inline-block;
                }

                .start-btn {
                    width: 100%;
                    padding: 18px;
                    background: var(--accent);
                    color: white;
                    border: none;
                    border-radius: 12px;
                    font-size: 16px;
                    font-weight: 800;
                    cursor: pointer;
                    transition: background 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                }
                
                .start-btn:hover:not(:disabled) {
                    background: var(--accent-hover);
                }
                
                .start-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @media (max-width: 900px) {
                    .modes-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
                @media (max-width: 600px) {
                    .modes-grid {
                        grid-template-columns: 1fr;
                    }
                    .quality-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                }
            `}</style>

            <ConfirmModal
                isOpen={showConfirmClear}
                title="Clear Staging?"
                message="This will clear all staged URLs and current input. This action cannot be undone."
                onConfirm={executeClearStaging}
                onCancel={() => setShowConfirmClear(false)}
                confirmText="Clear"
                cancelText="Cancel"
            />

        </div>
    );
};
