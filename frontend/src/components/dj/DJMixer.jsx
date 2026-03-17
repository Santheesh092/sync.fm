import { useState, useRef, useEffect, useCallback } from 'react';
import VerticalSlider from './VerticalSlider';

function RotaryKnob({ label, type = 'mid', value, onChange }) {
    const isDragging = useRef(false);
    const startY = useRef(0);
    const startVal = useRef(0);

    const handlePointerDown = (e) => {
        isDragging.current = true;
        startY.current = e.clientY;
        startVal.current = value;
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        const deltaY = startY.current - e.clientY;
        const newVal = Math.max(0, Math.min(1, startVal.current + deltaY / 100));
        onChange(newVal);
    };

    const handlePointerUp = (e) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const angle = -135 + (value * 270);
    const knobColors = {
        gain: '#F2C21A', hi: '#00CFFF', mid: '#CC44FF', low: '#FF8C00'
    };
    const color = knobColors[type] || '#F2C21A';

    return (
        <div className="flex flex-col items-center gap-1 group">
            <div
                className="relative w-10 h-10 rounded-full cursor-ns-resize select-none border-2 border-[#000] p-[2px]"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onDoubleClick={() => onChange(0.5)}
                style={{
                    background: 'var(--brushed-metal)',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.1)',
                    transform: `rotate(${angle}deg)`
                }}>
                {/* Visual indicator on the side of the knob */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full rounded-full opacity-30" style={{ background: 'var(--chrome-finish)' }} />
                
                <div
                    className="absolute top-1 left-1/2 -translate-x-1/2 w-1.5 h-3 rounded-full z-10"
                    style={{ background: color, boxShadow: `0 0 10px ${color}, 0 0 2px #fff` }} />
            </div>
            <div className="text-[8px] font-black tracking-[0.2em] uppercase transition-colors group-hover:text-white/80"
                style={{ color: 'rgba(255,255,255,0.2)' }}>{label}</div>
        </div>
    );
}

function ChannelStrip({ label, eq, fader, vu, onEqChange, onFaderChange, expanded }) {
    const accentColor = label === 'A' ? '#00CFFF' : '#CC44FF';
    return (
        <div className="flex flex-col items-center gap-3 flex-1 h-full min-h-[320px]">
            <div className="text-[10px] font-black tracking-widest" style={{ color: accentColor }}>CH {label}</div>

            <RotaryKnob label="GAIN" type="gain" value={(eq.gain + 60) / 72}
                onChange={v => onEqChange('gain', (v * 72) - 60)} />

            <div className="w-8 h-px bg-white/10" />

            <div className="flex flex-col gap-2.5">
                <RotaryKnob label="HI" type="hi" value={(eq.hi + 24) / 48}
                    onChange={v => onEqChange('hi', (v * 48) - 24)} />
                <RotaryKnob label="MID" type="mid" value={(eq.mid + 24) / 48}
                    onChange={v => onEqChange('mid', (v * 48) - 24)} />
                <RotaryKnob label="LOW" type="low" value={(eq.low + 24) / 48}
                    onChange={v => onEqChange('low', (v * 48) - 24)} />
            </div>

            <div className={`flex gap-3 mt-auto w-full justify-center transition-all duration-500 ease-in-out ${expanded ? 'h-64' : 'h-28'}`}>
                {/* Segmented VU Meter - Premium LED Look */}
                <div className="flex flex-col-reverse gap-[2px] w-3 h-full justify-between items-center py-1 bg-black/60 rounded-full border border-white/5 relative overflow-hidden">
                    {/* Glassy Overlay for VU Meter */}
                    <div className="absolute inset-0 z-20 pointer-events-none opacity-10" style={{ background: 'var(--glossy-overlay)' }} />
                    
                    {Array.from({ length: 14 }).map((_, i) => {
                        const threshold = (i + 1) / 14;
                        const isActive = vu >= threshold;
                        let color = '#00FF88'; // Green
                        if (threshold > 0.85) color = '#FF4444'; // Red
                        else if (threshold > 0.65) color = '#F2C21A'; // Yellow
                        
                        return (
                            <div
                                key={i}
                                className="w-[70%] h-full rounded-[1px] transition-all duration-75 relative z-10"
                                style={{
                                    background: isActive ? color : 'rgba(255,255,255,0.02)',
                                    boxShadow: isActive ? `0 0 12px ${color}CC, 0 0 4px #fff` : 'none',
                                    border: isActive ? `1px solid rgba(255,255,255,0.4)` : 'none'
                                }}
                            />
                        );
                    })}
                </div>
                {/* Channel Fader */}
                <VerticalSlider
                    min={0} max={100}
                    value={fader * 100}
                    unit=""
                    onChange={(v) => onFaderChange(v / 100)}
                    resetValue={80}
                    color={accentColor}
                />
            </div>
        </div>
    );
}

/**
 * Custom Crossfader — mouse + touch drag, 0=full A, 1=full B
 */
function Crossfader({ value, onChange }) {
    const trackRef = useRef(null);
    const isDragging = useRef(false);

    const posToValue = useCallback((clientX) => {
        const track = trackRef.current;
        if (!track) return value;
        const rect = track.getBoundingClientRect();
        const raw = (clientX - rect.left) / rect.width;
        return Math.max(0, Math.min(1, raw));
    }, [value]);

    const onPointerDown = (e) => {
        isDragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onChange(posToValue(e.clientX));
    };

    const onPointerMove = (e) => {
        if (!isDragging.current) return;
        onChange(posToValue(e.clientX));
    };

    const onPointerUp = (e) => {
        isDragging.current = false;
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const pct = Math.round(value * 100);
    const thumbLeft = `calc(${value * 100}% - 10px)`;

    return (
        <div className="flex flex-col gap-2 w-full select-none">
            {/* Label Row */}
            <div className="flex justify-between items-center px-1">
                <span className="text-xs font-black" style={{ color: '#00CFFF', textShadow: '0 0 8px #00CFFF' }}>A</span>
                <span className="text-[9px] tracking-[0.3em] font-bold text-white/30 uppercase">Crossfader</span>
                <span className="text-xs font-black" style={{ color: '#CC44FF', textShadow: '0 0 8px #CC44FF' }}>B</span>
            </div>

            {/* Track + Thumb */}
            <div
                ref={trackRef}
                className="relative h-10 flex items-center cursor-grab active:cursor-grabbing rounded-xl overflow-hidden"
                style={{
                    background: 'var(--brushed-metal)',
                    border: '1.5px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.05)',
                    touchAction: 'none'
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}>

                {/* Track Glow */}
                <div className="absolute inset-0 opacity-10 blur-xl pointer-events-none"
                     style={{ background: `linear-gradient(to right, #00CFFF, #CC44FF)` }} />

                {/* Gradient fill */}
                <div
                    className="absolute left-0 top-0 bottom-0 rounded-l-xl pointer-events-none"
                    style={{
                        width: `${value * 100}%`,
                        background: 'linear-gradient(to right, rgba(0,207,255,0.2), rgba(204,68,255,0.2))',
                        transition: isDragging.current ? 'none' : 'width 0.1s'
                    }} />

                {/* Thumb - Premium Chrome Handle */}
                <div
                    className="absolute w-6 h-8 rounded-lg pointer-events-none flex items-center justify-center border border-white/20"
                    style={{
                        left: thumbLeft,
                        background: 'var(--chrome-finish)',
                        boxShadow: '0 8px 16px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.8)'
                    }}>
                    {/* Indicator line on crossfader thumb */}
                    <div className="w-[2px] h-[60%] bg-red-500 shadow-[0_0_8px_#ff0000]" />
                </div>
            </div>

            {/* Position % */}
            <div className="text-center font-mono text-[9px] text-white/30">
                {value < 0.45
                    ? <span style={{ color: '#00CFFF' }}>A {Math.round((1 - value) * 100)}%</span>
                    : value > 0.55
                        ? <span style={{ color: '#CC44FF' }}>B {pct}%</span>
                        : <span className="text-white/40">CENTER</span>}
            </div>
        </div>
    );
}

export default function DJMixer({ state, onMixerChange, deckAExpanded, deckBExpanded }) {
    const curves = ['linear', 'smooth', 'sharp'];
    const isAnyExpanded = deckAExpanded || deckBExpanded;

    return (
        <div className={`flex flex-col p-5 gap-5 rounded-3xl border transition-all duration-500 ease-in-out ${isAnyExpanded ? 'w-[320px] h-full' : 'w-64 flex-shrink-0'}`}
            style={{ 
                background: 'linear-gradient(135deg, #1a1a1a 0%, #0d0d0d 100%)', 
                backdropFilter: 'blur(25px)',
                borderColor: 'rgba(255,255,255,0.05)',
                boxShadow: '20px 0 50px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05)'
            }}>

            {/* Channel Strips */}
            <div className="flex gap-4 flex-1">
                <ChannelStrip
                    label="A"
                    eq={state.deckA.eq}
                    fader={state.deckA.fader}
                    vu={state.deckA.vu}
                    onEqChange={(band, val) => onMixerChange('A', 'eq', { band, val })}
                    onFaderChange={(val) => onMixerChange('A', 'fader', val)}
                    expanded={isAnyExpanded}
                />
                <ChannelStrip
                    label="B"
                    eq={state.deckB.eq}
                    fader={state.deckB.fader}
                    vu={state.deckB.vu}
                    onEqChange={(band, val) => onMixerChange('B', 'eq', { band, val })}
                    onFaderChange={(val) => onMixerChange('B', 'fader', val)}
                    expanded={isAnyExpanded}
                />
            </div>

            {/* Crossfader Section */}
            <div className="pt-3 border-t border-white/8 flex flex-col gap-3">
                <Crossfader
                    value={state.crossfader}
                    onChange={(v) => onMixerChange('crossfader', null, v)}
                />

                {/* Curve Mode Buttons */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                        {curves.map(c => {
                            const isActive = state.curve === c;
                            // Tiny SVG illustrating the curve shape
                            const curveIcon = {
                                linear: (
                                    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
                                        <line x1="2" y1="9" x2="20" y2="1" stroke={isActive ? '#000' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" strokeLinecap="round"/>
                                    </svg>
                                ),
                                smooth: (
                                    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
                                        <path d="M2 9 C4 9 7 5 11 5 C15 5 18 1 20 1" stroke={isActive ? '#000' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" fill="none" strokeLinecap="round"/>
                                    </svg>
                                ),
                                sharp: (
                                    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
                                        <polyline points="2,9 11,9 11,1 20,1" stroke={isActive ? '#000' : 'rgba(255,255,255,0.35)'} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )
                            }[c];

                            return (
                                <button
                                    key={c}
                                    onClick={() => onMixerChange('curve', null, c)}
                                    className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded font-black tracking-widest uppercase transition-all"
                                    style={isActive
                                        ? { background: '#F2C21A', color: '#000', boxShadow: '0 0 10px rgba(242,194,26,0.5)' }
                                        : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                    {curveIcon}
                                    <span className="text-[7px]">{c === 'sharp' ? 'SHARP' : c === 'smooth' ? 'SMOOTH' : 'LINEAR'}</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* Active curve description */}
                    <div className="text-center text-[7px] leading-tight px-1" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {state.curve === 'linear' && 'Both decks fade together — audible dip at center'}
                        {state.curve === 'smooth' && 'Equal-power — no dip, seamless blend'}
                        {state.curve === 'sharp' && 'Hard cut — instant switch at center'}
                    </div>
                </div>
            </div>
        </div>
    );
}
