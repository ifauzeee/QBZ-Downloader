import React, { useState, useEffect, useCallback } from 'react';
import { Icons } from './Icons';
import { useToast } from '../contexts/ToastContext';
import { smartFetch } from '../utils/api';
import '../styles/DropZone.css';

interface DropZoneProps {
    children: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({ children }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [_dragCounter, setDragCounter] = useState(0);
    const [dragType, setDragType] = useState<'url' | 'file' | 'none'>('none');
    const { showToast } = useToast();

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setDragCounter(prev => prev + 1);

        if (e.dataTransfer.types.includes('text/uri-list') || e.dataTransfer.types.includes('text/plain')) {
            setDragType('url');
            setIsDragging(true);
        } else if (e.dataTransfer.types.includes('Files')) {
            setDragType('file');
            setIsDragging(true);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        setDragCounter(prev => {
            const next = prev - 1;
            if (next <= 0) {
                setIsDragging(false);
                return 0;
            }
            return next;
        });
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setDragCounter(0);

        const url = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
        const files = Array.from(e.dataTransfer.files);

        if (url && (url.includes('qobuz.com') || url.includes('open.qobuz.com'))) {
            try {
                showToast('Parsing Qobuz URL...', 'info');
                const res = await smartFetch('/api/queue/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                if (res && res.ok) {
                    showToast('Successfully added to queue', 'success');
                } else {
                    const data = await res?.json();
                    showToast(data?.error || 'Failed to add URL', 'error');
                }
            } catch (err) {
                showToast('Network error while adding URL', 'error');
            }
        } else if (files.length > 0) {
            const lrcFile = files.find(f => f.name.toLowerCase().endsWith('.lrc'));
            if (lrcFile) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target?.result as string;
                    if (content) {
                        window.dispatchEvent(new CustomEvent('qbz:lrc-dropped', { 
                            detail: { content, fileName: lrcFile.name } 
                        }));
                    }
                };
                reader.readAsText(lrcFile);
            } else {
                showToast('Unsupported file type dropped', 'error');
            }
        }
    }, [showToast]);

    useEffect(() => {
        const handleWindowDragOver = (e: DragEvent) => e.preventDefault();
        const handleWindowDrop = (e: DragEvent) => e.preventDefault();
        
        window.addEventListener('dragover', handleWindowDragOver);
        window.addEventListener('drop', handleWindowDrop);
        
        return () => {
            window.removeEventListener('dragover', handleWindowDragOver);
            window.removeEventListener('drop', handleWindowDrop);
        };
    }, []);

    return (
        <div 
            className="drop-zone-container"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            style={{ position: 'relative', width: '100%', height: '100%' }}
        >
            {children}
            
            <div 
                className={`drop-zone-overlay ${isDragging ? 'active' : ''}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => {
                    setIsDragging(false);
                    setDragCounter(0);
                }}
            >
                <div className="drop-zone-content">
                    <div className="drop-zone-icon">
                        {dragType === 'url' ? <Icons.Download width={40} height={40} /> : <Icons.File width={40} height={40} />}
                    </div>
                    <h2>{dragType === 'url' ? 'Add to Queue' : 'Import Lyrics'}</h2>
                    <p>
                        {dragType === 'url' 
                            ? 'Drop the Qobuz URL here to start downloading automatically.' 
                            : 'Drop the .lrc file to sync lyrics with the current track.'}
                    </p>
                    {isDragging && dragType === 'url' && (
                        <div className="drop-zone-file-info">
                            <Icons.Search width={16} height={16} />
                            <span>Detecting Qobuz Link...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
