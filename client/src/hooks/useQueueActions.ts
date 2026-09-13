import { useCallback } from 'react';
import { smartFetch } from '../utils/api';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';

export function useQueueActions() {
    const { showToast } = useToast();
    const { addToStaging, settings } = useSettings();
    const { t } = useLanguage();

    const addToQueue = useCallback(
        async (type: string, id: string | number): Promise<boolean> => {
            if (!id) {
                showToast('Invalid content ID', 'error');
                return false;
            }
            try {
                const res = await smartFetch('/api/queue/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type, id: String(id) })
                });
                if (res && res.ok) {
                    showToast(t('msg_added_to_queue') || 'Added to queue', 'success');
                    return true;
                }
                showToast('Failed to add to queue', 'error');
                return false;
            } catch (e) {
                showToast('Network error', 'error');
                return false;
            }
        },
        [showToast, t]
    );

    const addToBatchStaging = useCallback(
        async (type: string, id: string) => {
            const url = `https://open.qobuz.com/${type}/${id}`;
            const existing = settings.UI_BATCH_STAGING_URLS || '';
            if (existing.includes(url)) {
                showToast('Already in Batch Staging', 'info');
                return;
            }
            await addToStaging(url);
            showToast('Added to Batch Staging', 'success');
        },
        [settings.UI_BATCH_STAGING_URLS, addToStaging, showToast]
    );

    return { addToQueue, addToBatchStaging };
}