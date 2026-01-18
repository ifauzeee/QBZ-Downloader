import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { smartFetch } from '../utils/api';

interface LyricsLine {
    id: string;
    time: number;
    text: string;
}

interface LyricsEditorProps {
    track: { id: string; title: string; artist: string; cover: string };
    initialContent: string;
    currentTime: number;
    onSave: () => void;
    onClose: () => void;
    audioRef: React.RefObject<HTMLAudioElement>;
}

export const LyricsEditor: React.FC<LyricsEditorProps> = ({
    track,
    initialContent,
    currentTime,
    onSave,
    onClose,
    audioRef
}) => {
    const [lines, setLines] = useState<LyricsLine[]>([]);
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [tapMode, setTapMode] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const isUserScrolling = useRef(false);
    const scrollTimeout = useRef<any>(null);

    useEffect(() => {
        const parsed = parseLrc(initialContent);
        setLines(parsed);
    }, [initialContent]);

    useEffect(() => {
        const index = lines.findIndex((line, i) => {
            const next = lines[i + 1];
            return line.time <= currentTime && (!next || next.time > currentTime);
        });
        setActiveIndex(index);

        if (!tapMode && index !== -1 && scrollRef.current && !isUserScrolling.current) {
            const el = scrollRef.current.children[index] as HTMLElement;
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [currentTime, lines, tapMode]);

    const handleScroll = () => {
        isUserScrolling.current = true;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
        scrollTimeout.current = setTimeout(() => {
            isUserScrolling.current = false;
        }, 3000);
    };

    const parseLrc = (lrc: string): LyricsLine[] => {
        const lines = lrc.split('\n');
        const parsed: LyricsLine[] = [];
        let idCounter = 0;

        for (const line of lines) {
            const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (match) {
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const ms = parseInt(match[3].padEnd(3, '0').substring(0, 3));
                const time = min * 60 + sec + ms / 1000;
                const text = match[4].trim();
                parsed.push({ id: `line-${idCounter++}`, time, text });
            } else if (line.trim()) {
                parsed.push({ id: `line-${idCounter++}`, time: 0, text: line.trim() });
            }
        }
        return parsed;
    };

    const formatLrcTime = (time: number): string => {
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 100);
        return `[${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}]`;
    };

    const handleSave = async () => {
        const content = lines
            .map(line => `${formatLrcTime(line.time)} ${line.text}`)
            .join('\n');

        try {
            await smartFetch(`/api/lyrics/${track.id}/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content })
            });
            onSave();
        } catch (error) {
            console.error('Failed to save lyrics', error);
            alert('Failed to save lyrics');
        }
    };

    const updateLine = (index: number, changes: Partial<LyricsLine>) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], ...changes };
        setLines(newLines);
    };

    const handleReset = () => {
        if (confirm('Discard changes and reset to original?')) {
            setLines(parseLrc(initialContent));
        }
    };

    const [tapCursor, setTapCursor] = useState<number>(0);

    const triggerTap = () => {
        if (tapCursor < lines.length) {
            updateLine(tapCursor, { time: currentTime });
            setTapCursor(tapCursor + 1);

            if (scrollRef.current) {
                const el = scrollRef.current.children[tapCursor + 1] as HTMLElement;
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (tapMode && e.code === 'Space') {
                e.preventDefault();
                triggerTap();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tapMode, tapCursor, currentTime]);

    return (
        <div className="lyrics-editor-overlay">
            <div className="editor-header">
                <h3>Lyrics Editor</h3>
                <div className="editor-controls">
                    <button
                        className={`editor-btn ${tapMode ? 'active' : ''}`}
                        onClick={() => {
                            setTapMode(!tapMode);
                            if (!tapMode) setTapCursor(Math.max(0, activeIndex));
                        }}
                    >
                        {tapMode ? '🔴 Tap to Sync' : '⚡ Tap Mode'}
                    </button>
                    <button className="editor-btn primary" onClick={handleSave}>Save</button>
                    <button className="editor-btn" onClick={handleReset}>Reset</button>
                    <button className="editor-btn" onClick={onClose}><Icons.Close width={18} /></button>
                </div>
            </div>

            <div className="editor-content" ref={scrollRef} onScroll={handleScroll}>
                {lines.map((line, i) => (
                    <div
                        key={line.id}
                        className={`editor-line ${i === activeIndex ? 'active-playback' : ''} ${tapMode && i === tapCursor ? 'cursor-tap' : ''}`}
                        onClick={() => {
                            if (tapMode) setTapCursor(i);
                            else if (audioRef.current) audioRef.current.currentTime = line.time;
                        }}
                    >
                        <div className="line-time">
                            <input
                                type="text"
                                value={formatLrcTime(line.time)}
                                onChange={(e) => {
                                    const match = e.target.value.match(/\[(\d+):(\d+)\.(\d+)\]/);
                                    if (match) {
                                        const t = parseInt(match[1]) * 60 + parseInt(match[2]) + parseInt(match[3]) / 100;
                                        updateLine(i, { time: t });
                                    }
                                }}
                            />
                        </div>
                        <div className="line-text">
                            <input
                                type="text"
                                value={line.text}
                                onChange={(e) => updateLine(i, { text: e.target.value })}
                            />
                        </div>
                        <div className="line-actions">
                            <button onClick={(e) => {
                                e.stopPropagation();
                                updateLine(i, { time: currentTime });
                            }} title="Set to current time">
                                <Icons.History width={14} />
                            </button>
                            <button onClick={(e) => {
                                e.stopPropagation();
                                const newLines = [...lines];
                                newLines.splice(i, 1);
                                setLines(newLines);
                            }} className="delete-btn">
                                <Icons.Trash width={14} />
                            </button>
                        </div>
                    </div>
                ))}
                <button className="add-line-btn" onClick={() => {
                    const lastTime = lines.length > 0 ? lines[lines.length - 1].time : 0;
                    setLines([...lines, { id: `line-${Date.now()}`, time: lastTime + 2, text: '' }]);
                }}>
                    + Add Line
                </button>
            </div>

            {tapMode && (
                <div className="tap-overlay" onClick={triggerTap}>
                    <div className="tap-indicator">
                        <h2>TAP TO SYNC</h2>
                        <p>Press Space or Tap Anywhere</p>
                        <div className="next-line">
                            Next: {lines[tapCursor]?.text || '(End)'}
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .lyrics-editor-overlay {
                    position: absolute;
                    inset: 0;
                    height: 100%;
                    background: rgba(15, 15, 20, 0.98);
                    backdrop-filter: blur(60px) saturate(200%);
                    -webkit-backdrop-filter: blur(60px) saturate(200%);
                    z-index: 2005;
                    display: flex;
                    flex-direction: column;
                    padding: 40px;
                    border-radius: 32px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
                }

                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                }

                .editor-header h3 {
                    margin: 0;
                    color: #fff;
                }

                .editor-controls {
                    display: flex;
                    gap: 10px;
                }

                .editor-btn {
                    padding: 8px 18px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.05);
                    background: rgba(255,255,255,0.05);
                    color: rgba(255,255,255,0.8);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 13px;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .editor-btn:hover {
                    background: rgba(255,255,255,0.1);
                    color: #fff;
                }

                .editor-btn.primary {
                    background: var(--accent, #6366f1);
                    color: #fff;
                    border: none;
                }
                
                .editor-btn.primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .editor-btn.active {
                    background: #ff3b30;
                    animation: pulse 2s infinite;
                }

                .editor-content {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 20px 0;
                    mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
                    -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
                }
                
                .editor-content::-webkit-scrollbar {
                    width: 0px;
                }

                .editor-line {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px 20px;
                    border-radius: 16px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.03);
                    transition: all 0.2s;
                    width: 100%;
                    max-width: 800px;
                }

                .editor-line:hover {
                    background: rgba(255,255,255,0.05);
                }

                .editor-line.active-playback {
                    background: rgba(99, 102, 241, 0.1);
                    border-color: rgba(99, 102, 241, 0.3);
                }

                .editor-line.cursor-tap {
                    background: rgba(255, 59, 48, 0.1);
                    border-color: rgba(255, 59, 48, 0.5);
                }

                .line-time input {
                    width: 100px;
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.5);
                    font-family: monospace;
                    font-size: 13px;
                }

                .line-text {
                    flex: 1;
                }

                .line-text input {
                    width: 100%;
                    background: transparent;
                    border: none;
                    color: #fff;
                    font-size: 15px;
                }

                .line-actions {
                    display: flex;
                    gap: 4px;
                    opacity: 0;
                    transition: opacity 0.2s;
                }

                .editor-line:hover .line-actions {
                    opacity: 1;
                }

                .line-actions button {
                    padding: 4px;
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    cursor: pointer;
                }

                .line-actions button:hover {
                    color: #fff;
                }

                .line-actions .delete-btn:hover {
                    color: #ff3b30;
                }

                .add-line-btn {
                    margin-top: 10px;
                    padding: 10px;
                    background: rgba(255,255,255,0.05);
                    border: 1px dashed rgba(255,255,255,0.2);
                    color: rgba(255,255,255,0.6);
                    border-radius: 8px;
                    cursor: pointer;
                }
                
                .tap-overlay {
                    position: absolute;
                    inset: 0;
                    background: rgba(0,0,0,0.6);
                    backdrop-filter: blur(4px);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                
                .tap-indicator {
                    text-align: center;
                    color: #fff;
                    background: rgba(0,0,0,0.8);
                    padding: 40px;
                    border-radius: 20px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                
                .tap-indicator h2 {
                    color: #ff3b30;
                    margin: 0 0 10px 0;
                }
                
                .next-line {
                    margin-top: 20px;
                    font-size: 20px;
                    font-weight: bold;
                    color: #fff;
                    max-width: 400px;
                }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 59, 48, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 59, 48, 0); }
                }
            `}</style>
        </div>
    );
};
