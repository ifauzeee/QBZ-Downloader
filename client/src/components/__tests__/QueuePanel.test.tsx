import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueuePanel } from '../QueuePanel';

// Mock Framer Motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children }: any) => <div>{children}</div>,
    Item: ({ children, className }: any) => <div className={className}>{children}</div>
  }
}));

const mockClearQueue = vi.fn();
const mockSetShowQueue = vi.fn();
const mockRemoveFromQueue = vi.fn();
const mockSetCurrentTrackIndex = vi.fn();

vi.mock('../../contexts/PlayerContext', () => ({
  usePlayer: () => ({
    playQueue: [
        { id: '1', title: 'Queue Track 1', artist: 'Artist 1', cover: '1.jpg' },
        { id: '2', title: 'Queue Track 2', artist: 'Artist 2', cover: '2.jpg' }
    ],
    setPlayQueue: vi.fn(),
    currentTrackIndex: 0,
    setCurrentTrackIndex: mockSetCurrentTrackIndex,
    removeFromQueue: mockRemoveFromQueue,
    clearQueue: mockClearQueue,
    showQueue: true,
    setShowQueue: mockSetShowQueue
  })
}));

describe('QueuePanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders queue items', () => {
        render(<QueuePanel />);
        expect(screen.getByText('Playback Queue')).toBeInTheDocument();
        expect(screen.getByText('Queue Track 1')).toBeInTheDocument();
        expect(screen.getByText('Queue Track 2')).toBeInTheDocument();
    });

    it('calls clearQueue when Clear All is clicked', () => {
        render(<QueuePanel />);
        fireEvent.click(screen.getByText('Clear All'));
        expect(mockClearQueue).toHaveBeenCalled();
    });

    it('calls remove action when remove button is clicked', () => {
        render(<QueuePanel />);
        const removeBtns = document.querySelectorAll('.remove-btn');
        fireEvent.click(removeBtns[0]);
        expect(mockRemoveFromQueue).toHaveBeenCalledWith(0);
    });
});
