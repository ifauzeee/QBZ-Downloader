import React, { useEffect, useState } from 'react';
import { smartFetch, getQualityLabel } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useLanguage } from '../contexts/LanguageContext';
import { ConfirmModal } from './Modals';
import { Icons } from './Icons';

interface HistoryItem {
    id: string;
    artist: string;
    albumArtist?: string;
    title: string;
    quality: number;
    filename: string;
    downloadedAt: string;
    contentId: string;
}

export const HistoryView: React.FC = () => {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const { t } = useLanguage();

    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await smartFetch('/api/history');
            if (res && res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = (id: string) => {
        setItemToDelete(id);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;

        try {
            const res = await smartFetch(`/api/history/${itemToDelete}`, { method: 'DELETE' });
            if (res && res.ok) {
                showToast(t('action_delete'), 'success');
                fetchHistory();
            } else {
                showToast('Failed to delete', 'error');
            }
        } catch (e) {
            showToast('Error deleting item', 'error');
        } finally {
            setItemToDelete(null);
        }
    };

    const handleClearHistory = async () => {
        try {
            const res = await smartFetch('/api/history/clear', { method: 'POST' });
            if (res && res.ok) {
                showToast('History cleared', 'success');
                fetchHistory();
            }
        } catch (e) {
            showToast('Failed to clear history', 'error');
        } finally {
            setShowClearConfirm(false);
        }
    };

    const downloadFile = (id: string) => {
        window.location.href = `/api/download/${id}`;
    };

    const exportHistory = (format: string) => {
        window.location.href = `/api/history/export?format=${format}`;
    };

    return (
        <div id="view-history" className="view-section active">
            <div className="history-toolbar">
                <div className="history-actions">
                    <button className="btn secondary" onClick={() => exportHistory('json')}>
                        <span className="icon"><Icons.Download width={14} height={14} /></span> {t('action_export_json')}
                    </button>
                    <button className="btn secondary" onClick={() => exportHistory('csv')}>
                        <span className="icon"><Icons.Download width={14} height={14} /></span> {t('action_export_csv')}
                    </button>
                </div>
                <button id="clear-history-btn" className="btn danger" onClick={() => setShowClearConfirm(true)}>
                    <span className="icon"><Icons.Trash width={14} height={14} /></span> {t('action_delete_history')}
                </button>
            </div>

            <div className="list-container">
                <div className="list-header" style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1.5fr 0.8fr 1.5fr 0.5fr', gap: '10px' }}>
                    <div>Date</div>
                    <div>Artist</div>
                    <div>Title</div>
                    <div>Quality</div>
                    <div>Filename</div>
                    <div>Action</div>
                </div>

                <div id="history-list" className="list-body">
                    {!loading && history.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-icon"><Icons.History width={48} height={48} /></div>
                            <h3>{t('msg_no_history')}</h3>
                            <p>{t('msg_history_empty')}</p>
                        </div>
                    )}

                    {!loading && history.map(item => (
                        <div key={item.id} className="list-row" style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1.5fr 0.8fr 1.5fr 0.5fr', gap: '10px' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                {new Date(item.downloadedAt).toLocaleString()}
                            </div>
                            <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.albumArtist || item.artist}</div>
                            <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                            <div>{getQualityLabel(item.quality)}</div>
                            <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => downloadFile(item.contentId || item.id)}>{t('action_download')}</button>
                                <button className="btn danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => confirmDelete(item.id)} title={t('action_delete')}><Icons.Trash width={14} height={14} /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {itemToDelete && (
                <ConfirmModal
                    title={t('action_delete')}
                    message={t('msg_confirm_delete')}
                    onConfirm={handleDelete}
                    onCancel={() => setItemToDelete(null)}
                    confirmText={t('action_delete')}
                    cancelText="Cancel"
                />
            )}

            {showClearConfirm && (
                <ConfirmModal
                    title={t('action_delete_history')}
                    message={t('msg_confirm_clear_history')}
                    onConfirm={handleClearHistory}
                    onCancel={() => setShowClearConfirm(false)}
                    confirmText={t('action_clear')}
                    cancelText="Cancel"
                />
            )}
        </div>
    );
};
