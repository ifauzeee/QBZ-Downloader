import React, { createContext, useContext, useState } from 'react';

export interface PlaybackTrack {
    id: string;
    title: string;
    artist: string;
    cover: string;
    duration?: number;
    albumId?: string;
}

interface PlayerContextType {
    showLyrics: boolean;
    setShowLyrics: (show: boolean) => void;
    isLyricsFullscreen: boolean;
    setIsLyricsFullscreen: (fullscreen: boolean) => void;
    showEditor: boolean;
    setShowEditor: (show: boolean) => void;
    
    // Playback Queue
    playQueue: PlaybackTrack[];
    setPlayQueue: (queue: PlaybackTrack[]) => void;
    currentTrackIndex: number;
    setCurrentTrackIndex: (index: number) => void;
    addToPlaybackQueue: (track: PlaybackTrack, playNow?: boolean) => void;
    removeFromQueue: (index: number) => void;
    clearQueue: () => void;
    showQueue: boolean;
    setShowQueue: (show: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType>({
    showLyrics: false,
    setShowLyrics: () => { },
    isLyricsFullscreen: false,
    setIsLyricsFullscreen: () => { },
    showEditor: false,
    setShowEditor: () => { },
    playQueue: [],
    setPlayQueue: () => { },
    currentTrackIndex: -1,
    setCurrentTrackIndex: () => { },
    addToPlaybackQueue: () => { },
    removeFromQueue: () => { },
    clearQueue: () => { },
    showQueue: false,
    setShowQueue: () => { },
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [showLyrics, setShowLyrics] = useState(false);
    const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    
    const [playQueue, setPlayQueue] = useState<PlaybackTrack[]>([]);
    const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
    const [showQueue, setShowQueue] = useState(false);

    const addToPlaybackQueue = (track: PlaybackTrack, playNow = false) => {
        setPlayQueue(prev => {
            const exists = prev.findIndex(t => t.id === track.id);
            if (exists !== -1) {
                if (playNow) setCurrentTrackIndex(exists);
                return prev;
            }
            
            const newQueue = [...prev, track];
            if (playNow) {
                setCurrentTrackIndex(newQueue.length - 1);
            } else if (currentTrackIndex === -1) {
                setCurrentTrackIndex(0);
            }
            return newQueue;
        });
    };

    const removeFromQueue = (index: number) => {
        const newQueue = playQueue.filter((_, i) => i !== index);
        setPlayQueue(newQueue);
        
        if (currentTrackIndex === index) {
            setCurrentTrackIndex(newQueue.length === 0 ? -1 : Math.min(index, newQueue.length - 1));
        } else if (currentTrackIndex > index) {
            setCurrentTrackIndex(prev => prev - 1);
        }
    };

    const clearQueue = () => {
        setPlayQueue([]);
        setCurrentTrackIndex(-1);
    };

    return (
        <PlayerContext.Provider value={{
            showLyrics, setShowLyrics,
            isLyricsFullscreen, setIsLyricsFullscreen,
            showEditor, setShowEditor,
            playQueue, setPlayQueue,
            currentTrackIndex, setCurrentTrackIndex,
            addToPlaybackQueue, removeFromQueue, clearQueue,
            showQueue, setShowQueue
        }}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => useContext(PlayerContext);
