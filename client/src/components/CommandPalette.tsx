import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';
import { useNavigation } from '../contexts/NavigationContext';
import { smartFetch } from '../utils/api';
import '../styles/CommandPalette.css';

interface CommandItem {
    id: string;
    label: string;
    sublabel?: string;
    icon: React.ReactNode;
    action: () => void;
    category: 'Navigation' | 'Actions' | 'Search Results' | 'History';
    shortcut?: string;
}

export const CommandPalette: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchResults, setSearchResults] = useState<CommandItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const { navigate, setActiveTab } = useNavigation();
    const inputRef = useRef<HTMLInputElement>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const navigationCommands: CommandItem[] = [
        { id: 'nav-dashboard', label: 'Go to Dashboard', icon: <Icons.Analytics />, category: 'Navigation', action: () => setActiveTab('queue'), shortcut: 'G D' },
        { id: 'nav-search', label: 'Search Music', icon: <Icons.Search />, category: 'Navigation', action: () => setActiveTab('search'), shortcut: 'G S' },
        { id: 'nav-library', label: 'Open Library', icon: <Icons.Library />, category: 'Navigation', action: () => setActiveTab('library'), shortcut: 'G L' },
        { id: 'nav-history', label: 'View History', icon: <Icons.History />, category: 'Navigation', action: () => setActiveTab('history'), shortcut: 'G H' },
        { id: 'nav-settings', label: 'Settings', icon: <Icons.Settings />, category: 'Navigation', action: () => setActiveTab('settings'), shortcut: 'G ,' },
    ];

    const staticCommands: CommandItem[] = [
        { id: 'action-batch', label: 'Batch Downloader', sublabel: 'Download multiple URLs at once', icon: <Icons.Batch />, category: 'Actions', action: () => setActiveTab('batch') },
        { id: 'action-health', label: 'Library Health', sublabel: 'Repair and organize your library', icon: <Icons.Resolve />, category: 'Actions', action: () => setActiveTab('health') },
    ];

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            } else if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    // Handle Search API
    useEffect(() => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const res = await smartFetch(`/api/search/suggestions?query=${encodeURIComponent(query)}`);
                if (res && res.ok) {
                    const data = await res.json();
                    const results: CommandItem[] = (data.suggestions || []).slice(0, 10).map((s: any, idx: number) => ({
                        id: `search-${idx}-${s.id}`,
                        label: s.text,
                        sublabel: s.type.charAt(0).toUpperCase() + s.type.slice(1),
                        icon: s.type === 'artist' ? <Icons.Mic /> : s.type === 'album' ? <Icons.Library /> : <Icons.Play />,
                        category: 'Search Results',
                        action: () => {
                            if (s.type === 'artist') {
                                navigate('artist', { id: s.id });
                            } else if (s.type === 'album') {
                                navigate('album', { id: s.id });
                            } else if (s.type === 'track') {
                                setActiveTab('search');
                            }
                        }
                    }));
                    setSearchResults(results);
                }
            } catch (err) {
                console.error('Command Palette Search Error:', err);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query, navigate, setActiveTab]);

    const filteredCommands = query.trim() 
        ? [...searchResults, ...navigationCommands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))]
        : [...navigationCommands, ...staticCommands];

    const handleAction = (item: CommandItem) => {
        item.action();
        setIsOpen(false);
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                handleAction(filteredCommands[selectedIndex]);
            }
        }
    };

    // Scroll selected item into view
    useEffect(() => {
        const selectedEl = resultsRef.current?.children[selectedIndex] as HTMLElement;
        if (selectedEl) {
            selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    if (!isOpen) return null;

    return createPortal(
        <div className="command-palette-overlay" onClick={() => setIsOpen(false)}>
            <div className="command-palette" onClick={e => e.stopPropagation()}>
                <div className="command-palette-search">
                    <Icons.Search className="command-palette-icon" />
                    <input
                        ref={inputRef}
                        className="command-palette-input"
                        placeholder="Type a command or search music..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                    />
                    {isLoading && <div className="spinner-mini"></div>}
                </div>
                
                <div className="command-palette-results" ref={resultsRef}>
                    {filteredCommands.length === 0 ? (
                        <div className="command-palette-empty" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No results found for "{query}"
                        </div>
                    ) : (
                        <>
                            {/* We could group by category here if we wanted more VS Code feel */}
                            {filteredCommands.map((item, index) => (
                                <div
                                    key={item.id}
                                    className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                                    onMouseEnter={() => setSelectedIndex(index)}
                                    onClick={() => handleAction(item)}
                                >
                                    <div className="command-palette-icon">
                                        {item.icon}
                                    </div>
                                    <div className="command-palette-info">
                                        <div className="command-palette-label">{item.label}</div>
                                        {item.sublabel && <div className="command-palette-sublabel">{item.sublabel}</div>}
                                    </div>
                                    {item.shortcut && (
                                        <div className="command-palette-shortcut">{item.shortcut}</div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <div className="command-palette-footer">
                    <div className="command-palette-hint"><kbd>↵</kbd> to select</div>
                    <div className="command-palette-hint"><kbd>↑</kbd><kbd>↓</kbd> to navigate</div>
                    <div className="command-palette-hint"><kbd>esc</kbd> to close</div>
                </div>
            </div>
        </div>,
        document.body
    );
};
