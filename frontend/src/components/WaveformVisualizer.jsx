import { useRef, useEffect } from 'react';

/**
 * Real-time waveform or frequency bar visualizer.
 * mode: 'waveform' | 'bars'
 */
export default function WaveformVisualizer({ analyser, isPlaying, mode = 'waveform', height = 80 }) {
    const canvasRef = useRef(null);
    const rafRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const draw = () => {
            rafRef.current = requestAnimationFrame(draw);

            const W = canvas.width;
            const H = canvas.height;
            ctx.clearRect(0, 0, W, H);

            // Idle animation when not playing
            if (!analyser || !isPlaying) {
                ctx.strokeStyle = 'rgba(242,194,26,0.25)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, H / 2);
                ctx.lineTo(W, H / 2);
                ctx.stroke();
                return;
            }

            if (mode === 'bars') {
                const bufLen = analyser.frequencyBinCount;
                const dataArr = new Uint8Array(bufLen);
                analyser.getByteFrequencyData(dataArr);

                const barW = W / bufLen * 2.5;
                let x = 0;
                for (let i = 0; i < bufLen; i++) {
                    const val = dataArr[i] / 255;
                    const barH = val * H;
                    const alpha = 0.3 + val * 0.7;
                    ctx.fillStyle = `rgba(242,194,26,${alpha})`;
                    ctx.fillRect(x, H - barH, barW - 1, barH);
                    x += barW;
                    if (x > W) break;
                }
            } else {
                // Waveform
                const bufLen = analyser.fftSize;
                const dataArr = new Uint8Array(bufLen);
                analyser.getByteTimeDomainData(dataArr);

                ctx.strokeStyle = '#F2C21A';
                ctx.lineWidth = 2.5;
                ctx.shadowBlur = 8;
                ctx.shadowColor = 'rgba(242,194,26,0.4)';
                ctx.beginPath();

                const sliceW = W / bufLen;
                let x = 0;
                for (let i = 0; i < bufLen; i++) {
                    const v = dataArr[i] / 128;
                    const y = (v * H) / 2;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    x += sliceW;
                }
                ctx.lineTo(W, H / 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        };

        // Resize observer
        const ro = new ResizeObserver(() => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        });
        ro.observe(canvas);
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;

        draw();
        return () => {
            cancelAnimationFrame(rafRef.current);
            ro.disconnect();
        };
    }, [analyser, isPlaying, mode]);

    return (
        <canvas
            ref={canvasRef}
            className="waveform-canvas"
            style={{ width: '100%', height, borderRadius: 12 }}
        />
    );
}
