import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { normalizePasswordForAuth } from '../utils/crypto';

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        let socketInstance: Socket | null = null;
        let cancelled = false;

        const connect = async () => {
            const password = await normalizePasswordForAuth(
                sessionStorage.getItem('dashboard_password')
            );
            if (cancelled) return;

            socketInstance = io('/', {
                auth: { password },
                transports: ['websocket', 'polling'],
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            socketInstance.on('connect', () => {
                setConnected(true);
                console.log('Socket connected:', socketInstance?.id);
            });

            socketInstance.on('disconnect', (reason) => {
                setConnected(false);
                console.log('Socket disconnected:', reason);
                if (reason === 'io server disconnect') {
                    socketInstance?.connect();
                }
            });

            socketInstance.on('connect_error', (err) => {
                console.error('Socket connection error:', err.message);
                if (err.message === 'Authentication failed') {
                    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                }
            });

            setSocket(socketInstance);
        };

        connect();

        return () => {
            cancelled = true;
            socketInstance?.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
