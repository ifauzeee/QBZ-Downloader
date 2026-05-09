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

    // Keep track of which element we're connected to
    const connectedElementRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!audioElement || !isPlaying) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        // Initialize AudioContext and Analyser only once
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                analyserRef.current.fftSize = 256;
            } catch (e) {
                console.error('AudioVisualizer: Failed to create AudioContext', e);
                return;
            }
        }

        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        // Handle reconnection if the audio element changed
        if (connectedElementRef.current !== audioElement) {
            try {
                // We can't easily disconnect a MediaElementSourceNode, but we can create a new one
                // for the new element. Note: if the same element is reused, createMediaElementSource will throw.
                sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
                sourceRef.current.connect(analyserRef.current!);
                analyserRef.current!.connect(audioContextRef.current.destination);
                connectedElementRef.current = audioElement;
            } catch (e) {
                console.warn('AudioVisualizer: Source already connected or failed', e);
                // If it failed, it might be because it's already connected (e.g. from a previous mount)
                // We'll assume it's okay to proceed if we have an analyser.
                connectedElementRef.current = audioElement;
            }
        }

        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const analyser = analyserRef.current;
        if (!analyser) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = (canvas.width / barCount);
            let x = 0;

            // Resolve color if it's a CSS variable
            let resolvedColor = color;
            if (color.startsWith('var(')) {
                resolvedColor = getComputedStyle(document.documentElement).getPropertyValue(color.slice(4, -1)).trim();
                if (!resolvedColor) resolvedColor = '#6366f1'; // fallback
            }

            for (let i = 0; i < barCount; i++) {
                const barHeight = (dataArray[i] / 255) * canvas.height;
                
                try {
                    const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                    gradient.addColorStop(0, resolvedColor);
                    
                    // Only append alpha if it looks like a hex color
                    if (resolvedColor.startsWith('#') && resolvedColor.length <= 7) {
                        gradient.addColorStop(1, `${resolvedColor}99`);
                    } else {
                        gradient.addColorStop(1, resolvedColor);
                    }

                    ctx.fillStyle = gradient;
                    
                    // Draw rounded bars
                    const radius = barWidth / 2;
                    ctx.beginPath();
                    if (ctx.roundRect) {
                        ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [radius, radius, 0, 0]);
                    } else {
                        ctx.rect(x, canvas.height - barHeight, barWidth - 2, barHeight);
                    }
                    ctx.fill();
                } catch (e) {
                    // Fallback to simple fill if gradient fails
                    ctx.fillStyle = resolvedColor;
                    ctx.fillRect(x, canvas.height - barHeight, barWidth - 2, barHeight);
                }

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

