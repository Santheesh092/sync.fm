import { useState, useRef, useEffect } from 'react';

/**
 * Custom Vertical Slider component that handles mouse and touch events correctly.
 * Native <input type="range"> rotated -90deg is buggy in responsive designs.
 * 
 * @param {Object} props
 * @param {number} props.min - Minimum value
 * @param {number} props.max - Maximum value
 * @param {number} props.value - Current value
 * @param {string} props.label - Label to display (optional)
 * @param {string} props.unit - Unit to display (e.g., %, semitones)
 * @param {function} props.onChange - Callback when value changes
 * @param {string} props.color - Accent color for the thumb/active track
 * @param {string} props.gradient - Optional CSS gradient for the track fill
 */
export default function VerticalSlider({
    min = 0,
    max = 100,
    value = 50,
    label,
    unit = '',
    onChange,
    color = '#F2C21A',
    gradient = null,
    showTicks = true,
    resetValue = null
}) {
    const trackRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);

    // Convert value to percentage (0 - 100)
    const percentage = ((value - min) / (max - min)) * 100;

    const handleValueChange = (clientY) => {
        if (!trackRef.current) return;

        const rect = trackRef.current.getBoundingClientRect();
        const height = rect.height;
        const y = clientY - rect.top;

        // Invert Y because top is 0 and bottom is 'height'
        // We want bottom to be 'min' and top to be 'max'
        let newPercentage = 1 - (y / height);
        newPercentage = Math.max(0, Math.min(1, newPercentage));

        const newValue = min + (newPercentage * (max - min));
        onChange(newValue);
    };

    const onPointerDown = (e) => {
        setIsDragging(true);
        handleValueChange(e.clientY);
        e.target.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        handleValueChange(e.clientY);
    };

    const onPointerUp = (e) => {
        setIsDragging(false);
        e.target.releasePointerCapture(e.pointerId);
    };

    const onDoubleClick = () => {
        if (resetValue !== null) {
            onChange(resetValue);
        } else {
            // Default reset to center if bi-directional, or min if uni-directional
            if (min < 0 && max > 0) onChange(0);
            else onChange(min);
        }
    };

    // Generate ticks
    const ticks = [];
    if (showTicks) {
        for (let i = 0; i <= 10; i++) {
            ticks.push(i * 10);
        }
    }

    return (
        <div className="flex flex-col items-center gap-1 h-full select-none group w-full">
            {label && <div className="text-[8px] sm:text-[9px] text-gray-500 font-bold uppercase tracking-widest">{label}</div>}

            <div
                ref={trackRef}
                className="relative w-6 sm:w-8 flex-1 min-h-[80px] sm:min-h-[100px] rounded-sm border border-[#000] cursor-ns-resize shadow-2xl overflow-hidden"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onDoubleClick={onDoubleClick}
                style={{
                    background: 'var(--brushed-metal)',
                    boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)'
                }}
            >
                {/* Illuminated Groove */}
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] opacity-30"
                    style={{ background: color, boxShadow: `0 0 10px ${color}` }} />

                {/* Tick Marks */}
                {ticks.map(t => (
                    <div
                        key={t}
                        className={`absolute left-0 w-1.5 sm:w-2 h-[1px] z-10 ${t === 50 ? 'bg-white/40 w-2.5 sm:w-3' : 'bg-white/10'}`}
                        style={{ bottom: `${t}%` }}
                    />
                ))}

                {/* Active Track (Gradient Fill) */}
                <div
                    className="absolute bottom-0 left-0 w-full z-10 transition-all duration-500 ease-in-out"
                    style={{
                        height: `${percentage}%`,
                        background: gradient || `linear-gradient(to top, ${color}33 0%, ${color}11 100%)`,
                        boxShadow: `0 0 20px ${color}22`,
                        opacity: 0.8
                    }}
                />

                {/* Center Detent Marker */}
                {(min < 0 && max > 0) && (
                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/30 z-10" />
                )}

                {/* Thumb - Premium Metallic Handle */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 w-8 sm:w-10 h-5 sm:h-6 rounded shadow-2xl z-20 border border-white/20 transition-all duration-500 ease-in-out group-hover:scale-105"
                    style={{
                        bottom: `calc(${percentage}% - 10px)`,
                        background: 'var(--chrome-finish)',
                        boxShadow: `0 8px 16px rgba(0,0,0,0.7), 0 0 8px ${color}44, inset 0 1px 1px rgba(255,255,255,0.8)`
                    }}
                >
                    {/* Visual line on thumb */}
                    <div className="absolute top-1/2 left-0 right-0 h-[1px] sm:h-[2px] bg-red-600 shadow-[0_0_8px_rgba(255,0,0,0.8)]" />

                    {/* Glow Dot */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full"
                        style={{
                            background: color,
                            boxShadow: `0 0 12px ${color}, 0 0 4px white`
                        }} />
                </div>
            </div>

            <div className="text-[8px] sm:text-[10px] font-mono w-10 sm:w-12 text-center bg-black/50 rounded py-0.5 text-white border border-white/5">
                {unit === '%' ?
                    `${(value > 1 ? '+' : value < 1 ? '' : '')}${((value - 1) * 100).toFixed(1)}%` :
                    `${(value > 0 && min < 0 ? '+' : '')}${value.toFixed(0 === value ? 0 : 1)}${unit}`
                }
            </div>
        </div>
    );
}
