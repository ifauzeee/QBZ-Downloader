import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
    socket: Socket | null;
    connected: boolean;
}

const SocketContext = createContext<SocketContextType>({ socket: null, connected: false });

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const password = sessionStorage.getItem('dashboard_password') || '';
        const socketInstance = io('/', {
            auth: { password }
        });

        socketInstance.on('connect', () => {
            setConnected(true);

        });

        socketInstance.on('disconnect', () => {
            setConnected(false);

        });

        socketInstance.on('connect_error', (err) => {
            if (err.message === 'Authentication failed') {
                window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
        });

        setSocket(socketInstance);

        return () => {
            socketInstance.disconnect();
        };
    }, []);

    return (
        <SocketContext.Provider value={{ socket, connected }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => useContext(SocketContext);
