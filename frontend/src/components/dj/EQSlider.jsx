import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * EQ-Specific Redesigned Vertical Slider for premium audio-tech feel.
 * Clean, minimal, and highly responsive.
 */
export default function EQSlider({
    min = -12,
    max = 12,
    value = 0,
    label,
    unit = 'dB',
    onChange,
    color = '#F2C21A',
    resetValue = 0
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
        onChange(resetValue);
    };

    // Calculate glow intensity based on value (0 to 1)
    const intensity = (value - min) / (max - min);

    return (
        <div className="flex flex-col items-center gap-2 h-full select-none group w-full px-1">
            <div
                className="relative flex-1 flex justify-center w-full min-w-[24px] sm:min-w-[40px] cursor-ns-resize touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onDoubleClick={onDoubleClick}
            >
                {/* Visual Track */}
                <div
                    ref={trackRef}
                    className="relative w-1.5 sm:w-2 h-full rounded-full bg-white/10 overflow-hidden"
                >
                    {/* Active Track (Glow Fill) */}
                    <div
                        className="absolute bottom-0 left-0 w-full rounded-full transition-all duration-150 ease-out"
                        style={{
                            height: `${percentage}%`,
                            background: color,
                            boxShadow: `0 0 ${10 + (intensity * 20)}px ${color}${Math.floor(intensity * 100).toString(16).padStart(2, '0')}`,
                        }}
                    />

                    {/* Center Mark */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 sm:w-6 h-[1px] bg-white/10" />
                </div>

                {/* Thumb - Larger and Touch Friendly (Sibling of track to avoid clipping) */}
                <motion.div
                    className="absolute left-1/2 -translate-x-1/2 z-20 cursor-grab active:cursor-grabbing pointer-events-none"
                    style={{
                        bottom: `calc(${percentage}% - 12px)`,
                    }}
                    animate={{ scale: isDragging ? 1.2 : 1 }}
                >
                    {/* The visible thumb circle */}
                    <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#111] border-2 border-white/20 relative shadow-xl">
                        <div 
                            className="absolute inset-0 rounded-full blur-[4px] opacity-40"
                            style={{ backgroundColor: color }}
                        />
                        <div 
                            className="absolute inset-1 rounded-full border border-white/10"
                            style={{ 
                                background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2) 0%, transparent 70%), ${color}`,
                                boxShadow: `0 0 ${isDragging ? 15 : 8}px ${color}88`
                            }}
                        />
                    </div>

                    {/* Value Tooltip */}
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.8 }}
                                animate={{ opacity: 1, y: -40, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.8 }}
                                className="absolute left-1/2 -translate-x-1/2 px-2 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded text-[10px] font-mono font-bold text-white whitespace-nowrap shadow-2xl pointer-events-none"
                            >
                                {value > 0 ? '+' : ''}{value.toFixed(1)}{unit}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
            
            {/* Label below */}
            {label && (
                <span className="text-[10px] sm:text-[11px] font-black tracking-tighter uppercase opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: color }}>
                    {label}
                </span>
            )}
        </div>
    );
}
