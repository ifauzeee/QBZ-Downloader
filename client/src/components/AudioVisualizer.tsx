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
    const animationFrameRef = useRef<number | null>(null);
    const [hasError, setHasError] = React.useState(false);
    const [errorMsg, setErrorMsg] = React.useState('');

    // Static map to keep track of sources across instances to avoid "already connected" error
    const sourceMap = React.useMemo(() => {
        if (!(window as any).__audio_sources) {
            (window as any).__audio_sources = new WeakMap();
        }
        return (window as any).__audio_sources as WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>;
    }, []);

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
            } catch (e: any) {
                console.error('AudioVisualizer: Failed to create AudioContext', e);
                setHasError(true);
                setErrorMsg('Web Audio API failed');
                return;
            }
        }

        if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
        }

        // Handle reconnection if the audio element changed
        if (connectedElementRef.current !== audioElement) {
            try {
                // Check if we already have a source for this element
                let source = sourceMap.get(audioElement);
                
                if (!source) {
                    source = audioContextRef.current.createMediaElementSource(audioElement);
                    sourceMap.set(audioElement, source);
                }

                source.connect(analyserRef.current!);
                analyserRef.current!.connect(audioContextRef.current.destination);
                connectedElementRef.current = audioElement;
                setHasError(false);
            } catch (e: any) {
                console.warn('AudioVisualizer: Source already connected or failed', e);
                setHasError(true);
                setErrorMsg(e.name === 'InvalidStateError' ? 'Audio already connected' : 'Visualizer error');
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

    if (hasError) {
        return (
            <div style={{ 
                width: '100%', 
                height: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                fontSize: '0.75em',
                color: 'var(--text-secondary)',
                opacity: 0.6,
                border: '1px dashed var(--border)',
                borderRadius: '4px'
            }}>
                {errorMsg}
            </div>
        );
    }

    return (
        <canvas 
            ref={canvasRef} 
            width={300} 
            height={40} 
            style={{ width: '100%', height: '100%', opacity: 0.6 }}
        />
    );
};

