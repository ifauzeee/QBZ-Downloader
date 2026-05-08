import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    audioElement: HTMLAudioElement | null;
    isPlaying: boolean;
    color?: string;
    barCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
    audioElement, 
    isPlaying, 
    color = '#6366f1',
    barCount = 64
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
    const animationFrameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!audioElement || !isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            
            try {
                sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
                sourceRef.current.connect(analyserRef.current);
                analyserRef.current.connect(audioContextRef.current.destination);
            } catch (e) {
                console.warn('AudioVisualizer: Failed to create source (already connected?)', e);
            }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserRef.current!.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current!.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / barCount);
            let x = 0;

            for (let i = 0; i < barCount; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, color);
                gradient.addColorStop(1, `${color}99`);

                ctx.fillStyle = gradient;
                
                // Draw rounded bars
                const radius = barWidth / 2;
                ctx.beginPath();
                ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [radius, radius, 0, 0]);
                ctx.fill();

                x += barWidth;
            }
        };

        draw();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioElement, isPlaying, color, barCount]);

    return (
        <canvas 
            ref={canvasRef} 
            width={300} 
            height={40} 
            style={{ width: '100%', height: '100%', opacity: 0.6 }}
        />
    );
};
