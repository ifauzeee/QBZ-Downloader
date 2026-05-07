import { EventEmitter } from 'events';

/**
 * Global event bus for inter-service communication.
 * Useful for decoupled communication between backend logic and Electron main process.
 */
class EventBus extends EventEmitter {
    private static instance: EventBus;

    private constructor() {
        super();
        this.setMaxListeners(20);
    }

    static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
}

export const eventBus = EventBus.getInstance();

export const EVENTS = {
    DOWNLOAD: {
        PROGRESS: 'download:progress',
        COMPLETE: 'download:complete',
        FAILED: 'download:failed'
    },
    QUEUE: {
        UPDATE: 'queue:update'
    },
    SYSTEM: {
        READY: 'system:ready'
    }
} as const;
