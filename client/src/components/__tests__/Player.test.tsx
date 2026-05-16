import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Player } from '../Player';

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

vi.mock('../../contexts/PlayerContext', () => ({
  usePlayer: () => ({
    showLyrics: false,
    setShowLyrics: vi.fn(),
    isLyricsFullscreen: false,
    setIsLyricsFullscreen: vi.fn(),
    showEditor: false,
    setShowEditor: vi.fn(),
    playQueue: [{ id: '1', title: 'Test Track', artist: 'Test Artist', cover: 'test.jpg' }],
    currentTrackIndex: 0,
    setCurrentTrackIndex: vi.fn(),
    addToPlaybackQueue: vi.fn(),
    showQueue: false,
    setShowQueue: vi.fn()
  })
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({ activeTab: 'home' })
}));

describe('Player', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
        window.HTMLMediaElement.prototype.pause = vi.fn();
    });

    it('renders without crashing', () => {
        render(<Player />);
        expect(screen.getAllByText('Test Track').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Test Artist').length).toBeGreaterThan(0);
    });

    it('toggles play/pause', () => {
        render(<Player />);
        const btns = document.querySelectorAll('.play-pause-btn');
        expect(btns.length).toBe(1);
        fireEvent.click(btns[0]);
        expect(btns[0]).toBeInTheDocument();
    });

    it('renders volume/seek slider', () => {
        render(<Player />);
        const slider = document.querySelector('.seek-slider');
        expect(slider).toBeInTheDocument();
    });
});
