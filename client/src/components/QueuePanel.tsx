import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePlayer } from '../contexts/PlayerContext';
import { Icons } from './Icons';
import '../styles/QueuePanel.css';

interface SortableItemProps {
    track: any;
    index: number;
    currentTrackIndex: number;
    handlePlayTrack: (index: number) => void;
    removeFromQueue: (index: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ 
    track, 
    index, 
    currentTrackIndex, 
    handlePlayTrack, 
    removeFromQueue 
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: track.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1001 : 1,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`queue-item ${index === currentTrackIndex ? 'active' : ''}`}
        >
            <div className="drag-handle" {...attributes} {...listeners}>
                <Icons.Batch width={14} height={14} />
            </div>
            <div className="item-art" onClick={() => handlePlayTrack(index)}>
                <img src={track.cover} alt="" onError={(e) => e.currentTarget.style.display = 'none'} />
                {index === currentTrackIndex && <div className="playing-indicator">▶</div>}
            </div>
            <div className="item-info" onClick={() => handlePlayTrack(index)}>
                <div className="item-title">{track.title}</div>
                <div className="item-artist">{track.artist}</div>
            </div>
            <button className="remove-btn" onClick={() => removeFromQueue(index)}>
                <Icons.Trash width={14} height={14} />
            </button>
        </div>
    );
};

export const QueuePanel: React.FC = () => {
    const { 
        playQueue, 
        setPlayQueue, 
        currentTrackIndex, 
        setCurrentTrackIndex, 
        removeFromQueue, 
        clearQueue, 
        showQueue, 
        setShowQueue 
    } = usePlayer();

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    if (!showQueue) return null;

    const handlePlayTrack = (index: number) => {
        setCurrentTrackIndex(index);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = playQueue.findIndex(t => t.id === active.id);
            const newIndex = playQueue.findIndex(t => t.id === over.id);
            setPlayQueue(arrayMove(playQueue, oldIndex, newIndex));
            
            // Adjust current track index if it moved
            if (currentTrackIndex === oldIndex) {
                setCurrentTrackIndex(newIndex);
            } else if (currentTrackIndex > oldIndex && currentTrackIndex <= newIndex) {
                setCurrentTrackIndex(currentTrackIndex - 1);
            } else if (currentTrackIndex < oldIndex && currentTrackIndex >= newIndex) {
                setCurrentTrackIndex(currentTrackIndex + 1);
            }
        }
    };

    return (
        <div className="queue-panel-overlay" onClick={() => setShowQueue(false)}>
            <div className="queue-panel" onClick={e => e.stopPropagation()}>
                <div className="queue-header">
                    <h3>Playback Queue</h3>
                    <div className="queue-actions">
                        <button className="text-btn" onClick={clearQueue}>Clear All</button>
                        <button className="icon-btn" onClick={() => setShowQueue(false)}>
                            <Icons.Close width={20} height={20} />
                        </button>
                    </div>
                </div>

                <div className="queue-list-container">
                    {playQueue.length === 0 ? (
                        <div className="empty-queue">
                            <Icons.Batch width={48} height={48} opacity={0.2} />
                            <p>Queue is empty</p>
                        </div>
                    ) : (
                        <DndContext 
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext 
                                items={playQueue.map(t => t.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="queue-list">
                                    {playQueue.map((track, index) => (
                                        <SortableItem 
                                            key={track.id} 
                                            track={track}
                                            index={index}
                                            currentTrackIndex={currentTrackIndex}
                                            handlePlayTrack={handlePlayTrack}
                                            removeFromQueue={removeFromQueue}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>
        </div>
    );
};
