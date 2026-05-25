import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BatchImportView } from '../BatchImportView';

const mocks = vi.hoisted(() => ({
    smartFetch: vi.fn(),
    showToast: vi.fn(),
    clearStaging: vi.fn(),
    settings: {
        UI_BATCH_STAGING_URLS: ''
    },
    settingsLoading: false
}));

vi.mock('../../utils/api', () => ({
    smartFetch: mocks.smartFetch
}));

vi.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: mocks.showToast })
}));

vi.mock('../../contexts/LanguageContext', () => ({
    useLanguage: () => ({ t: (key: string) => key })
}));

vi.mock('../../contexts/SettingsContext', () => ({
    useSettings: () => ({
        settings: mocks.settings,
        clearStaging: mocks.clearStaging,
        loading: mocks.settingsLoading
    })
}));

describe('BatchImportView', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.settings.UI_BATCH_STAGING_URLS = '';
        mocks.settingsLoading = false;
    });

    it('auto-loads staged Qobuz URLs into direct input', async () => {
        mocks.settings.UI_BATCH_STAGING_URLS =
            'https://open.qobuz.com/track/1\nhttps://open.qobuz.com/album/2';

        render(<BatchImportView />);

        const input = screen.getByPlaceholderText(/open\.qobuz\.com\/track/) as HTMLTextAreaElement;
        await waitFor(() => {
            expect(input.value).toContain('https://open.qobuz.com/track/1');
            expect(input.value).toContain('https://open.qobuz.com/album/2');
        });
        expect(mocks.showToast).toHaveBeenCalledWith('Auto-loaded 2 items from staging', 'success');
    });

    it('imports direct URLs with selected options and clears the textarea on success', async () => {
        mocks.smartFetch.mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ success: true, imported: 2 })
        });

        render(<BatchImportView />);

        fireEvent.change(screen.getByPlaceholderText(/open\.qobuz\.com\/track/), {
            target: {
                value:
                    'https://open.qobuz.com/track/1\n# ignored comment\nhttps://open.qobuz.com/album/2'
            }
        });
        fireEvent.click(screen.getByText('label_create_zip'));
        fireEvent.click(screen.getByText('action_start_import'));

        await waitFor(() => {
            expect(mocks.smartFetch).toHaveBeenCalledWith('/api/batch/import/direct', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    urls: ['https://open.qobuz.com/track/1', 'https://open.qobuz.com/album/2'],
                    quality: 27,
                    createZip: true
                })
            });
        });

        expect(mocks.showToast).toHaveBeenCalledWith('Imported 2 URLs!', 'success');
        expect(screen.getByPlaceholderText(/open\.qobuz\.com\/track/)).toHaveValue('');
    });

    it('clears staged URLs after confirmation', async () => {
        mocks.settings.UI_BATCH_STAGING_URLS = 'https://open.qobuz.com/track/1';

        render(<BatchImportView />);

        await waitFor(() => expect(screen.getAllByText('action_clear')[0]).not.toBeDisabled());
        fireEvent.click(screen.getAllByText('action_clear')[0]);
        const confirmButtons = screen.getAllByText('action_clear');
        fireEvent.click(confirmButtons[confirmButtons.length - 1]);

        expect(mocks.clearStaging).toHaveBeenCalled();
        expect(mocks.showToast).toHaveBeenCalledWith('Staging and input cleared', 'success');
    });
});
