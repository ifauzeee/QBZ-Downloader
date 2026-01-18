import React, { createContext, useContext, useState } from 'react';

interface PlayerContextType {
    showLyrics: boolean;
    setShowLyrics: (show: boolean) => void;
    isLyricsFullscreen: boolean;
    setIsLyricsFullscreen: (fullscreen: boolean) => void;
    showEditor: boolean;
    setShowEditor: (show: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType>({
    showLyrics: false,
    setShowLyrics: () => { },
    isLyricsFullscreen: false,
    setIsLyricsFullscreen: () => { },
    showEditor: false,
    setShowEditor: () => { },
});

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [showLyrics, setShowLyrics] = useState(false);
    const [isLyricsFullscreen, setIsLyricsFullscreen] = useState(false);
    const [showEditor, setShowEditor] = useState(false);

    return (
        <PlayerContext.Provider value={{
            showLyrics, setShowLyrics,
            isLyricsFullscreen, setIsLyricsFullscreen,
            showEditor, setShowEditor
        }}>
            {children}
        </PlayerContext.Provider>
    );
};

export const usePlayer = () => useContext(PlayerContext);
