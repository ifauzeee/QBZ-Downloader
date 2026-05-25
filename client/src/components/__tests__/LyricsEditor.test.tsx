import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LyricsEditor } from '../LyricsEditor';

const mocks = vi.hoisted(() => ({
    smartFetch: vi.fn()
}));

vi.mock('../../utils/api', () => ({
    smartFetch: mocks.smartFetch
}));

const track = {
    id: 'track-1',
    title: 'Test Track',
    artist: 'Test Artist',
    cover: 'cover.jpg'
};

const initialContent = '[00:10.00] First line\n[01:01.50] Chorus line';

describe('LyricsEditor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('parses LRC content and marks the active playback line', async () => {
        render(
            <LyricsEditor
                track={track}
                initialContent={initialContent}
                currentTime={61.6}
                onSave={vi.fn()}
                onClose={vi.fn()}
                audioRef={React.createRef<HTMLAudioElement>()}
            />
        );

        expect(screen.getByDisplayValue('[00:10.00]')).toBeInTheDocument();
        const activeLine = screen.getByDisplayValue('Chorus line').closest('.editor-line');
        await waitFor(() => expect(activeLine).toHaveClass('active-playback'));
    });

    it('serializes edited lyrics when saving', async () => {
        const onSave = vi.fn();
        mocks.smartFetch.mockResolvedValue({ ok: true });

        render(
            <LyricsEditor
                track={track}
                initialContent={initialContent}
                currentTime={12}
                onSave={onSave}
                onClose={vi.fn()}
                audioRef={React.createRef<HTMLAudioElement>()}
            />
        );

        fireEvent.change(screen.getByDisplayValue('First line'), {
            target: { value: 'Edited first line' }
        });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            expect(mocks.smartFetch).toHaveBeenCalledWith('/api/lyrics/track-1/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: '[00:10.00] Edited first line\n[01:01.50] Chorus line'
                })
            });
            expect(onSave).toHaveBeenCalled();
        });
    });

    it('uses tap mode to stamp the next line with current playback time', async () => {
        mocks.smartFetch.mockResolvedValue({ ok: true });

        render(
            <LyricsEditor
                track={track}
                initialContent={initialContent}
                currentTime={42}
                onSave={vi.fn()}
                onClose={vi.fn()}
                audioRef={React.createRef<HTMLAudioElement>()}
            />
        );

        fireEvent.click(screen.getByText(/Tap Mode/));
        fireEvent.keyDown(window, { code: 'Space' });
        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => {
            const call = mocks.smartFetch.mock.calls[0];
            expect(call[1].body).toContain('[00:42.00] First line');
        });
    });
});
