import { useState, useEffect, useRef } from 'react';
import {
    Upload, Link2, Users, FileAudio, Globe,
    Waves, RotateCw, Repeat, Home, Zap,
    Plus, Clock, Info, ExternalLink
} from 'lucide-react';
import VerticalSlider from './VerticalSlider';

// Per-pad color palette
const PAD_COLORS = [
    '#FF4444', '#FF8C00', '#00CFFF', '#00FF88', // Pads 1-4
    '#CC44FF', '#FF00FF', '#00FFFF', '#F2C21A'  // Pads 5-8
];

/**
 * Individual Hot Cue Pad — set/jump on click, clear on right-click or long press
 */
function HotCuePad({ index, cueTime, onSet, onJump, onClear, deckLabel }) {
    const isSet = cueTime !== null;
    const color = PAD_COLORS[index];
    const longPressTimer = useRef(null);
    const didLongPress = useRef(false);

    const formatCueTime = (t) => {
        if (t === null || isNaN(t)) return null;
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handlePointerDown = () => {
        didLongPress.current = false;
        longPressTimer.current = setTimeout(() => {
            didLongPress.current = true;
            onClear();
            // Visual flash on long press
        }, 500);
    };

    const handlePointerUp = () => {
        clearTimeout(longPressTimer.current);
    };

    const handlePointerLeave = () => {
        clearTimeout(longPressTimer.current);
    };

    const handleClick = () => {
        if (didLongPress.current) return; // Long press already handled
        if (!isSet) {
            onSet();
        } else {
            onJump();
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        onClear();
    };

    return (
        <button
            className="relative flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 select-none overflow-hidden"
            style={{
                minHeight: '64px',
                background: isSet ? `${color}15` : 'rgba(0,0,0,0.4)',
                border: `1.5px solid ${isSet ? color : 'rgba(255,255,255,0.05)'}`,
                boxShadow: isSet ? `0 0 20px ${color}40, inset 0 0 10px ${color}20` : 'inset 0 2px 5px rgba(0,0,0,0.3)',
                touchAction: 'none'
            }}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onClick={handleClick}
            onContextMenu={handleContextMenu}>

            {/* Glossy Overlay */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'var(--glossy-overlay)', opacity: 0.3 }} />

            {/* Pad number */}
            <span className="text-base font-black leading-none z-10"
                style={{ color: isSet ? color : 'rgba(255,255,255,0.1)', textShadow: isSet ? `0 0 10px ${color}` : 'none' }}>
                {index + 1}
            </span>

            {/* Cue label / timestamp */}
            <span className="text-[8px] font-bold font-mono leading-none mt-1 z-10"
                style={{ color: isSet ? `${color}CC` : 'rgba(255,255,255,0.1)' }}>
                {isSet ? formatCueTime(cueTime) : `CUE ${index + 1}`}
            </span>

            {/* Color dot indicator when set */}
            {isSet && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full z-10"
                    style={{ background: color, boxShadow: `0 0 6px ${color}, 0 0 2px #fff` }} />
            )}
        </button>
    );
}

export default function DJDeck({ label, deckState, engineDeck, onControlChange, onLoadFile, expanded, onToggleExpand, otherDeckExpanded }) {
    const [tempoRange, setTempoRange] = useState(0.08);
    const [rotation, setRotation] = useState(0);
    const isJogging = useRef(false);
    const lastAngle = useRef(0);
    const [jogActive, setJogActive] = useState(false);

    const [sourceTab, setSourceTab] = useState('LOCAL');
    const [recentFiles, setRecentFiles] = useState([]);
    const [streamUrl, setStreamUrl] = useState('');

    // Track both Source and FX expansion to notify parent
    const [sourceOpened, setSourceOpened] = useState(false);
    const [fxOpened, setFXOpened] = useState(false);

    useEffect(() => {
        onToggleExpand(sourceOpened || fxOpened);
    }, [sourceOpened, fxOpened, onToggleExpand]);

    // FX State
    const [activeFXSlot, setActiveFXSlot] = useState(null); // 'flanger' | 'phaser' | 'echo' | 'reverb'
    const [fxState, setFXState] = useState({
        flanger: { on: false, rate: 0.25, depth: 0.002, feedback: 0.1, mix: 0.5 },
        phaser: { on: false, rate: 0.5, resonance: 0.5, mix: 0.5, stages: 8 },
        echo: { on: false, time: 0.5, feedback: 0.4, mix: 0.5, sync: false, division: '1/4' },
        reverb: { on: false, mix: 0.3, type: 'Hall', size: 0.5, decay: 0.5, damping: 0.5, preDelay: 0.05 }
    });

    const handleFXParam = (fxType, param, value) => {
        setFXState(prev => ({
            ...prev,
            [fxType]: { ...prev[fxType], [param]: value }
        }));
        onControlChange('fx', fxType, { param, value });
    };

    const toggleFX = (fxType) => {
        const newState = !fxState[fxType].on;
        setFXState(prev => ({
            ...prev,
            [fxType]: { ...prev[fxType], on: newState }
        }));
        onControlChange('fx', fxType, { param: 'mix', value: newState ? fxState[fxType].mix : 0 });
    };

    // --- Sub-components for Source & FX ---

    const Knob = ({ label, value, min, max, onChange, color, size = 'sm' }) => {
        const knobSize = size === 'sm' ? 36 : 48;
        const radius = (knobSize / 2) - 4;
        const circumference = 2 * Math.PI * radius;
        const percentage = (value - min) / (max - min);
        const strokeDashoffset = circumference - (percentage * (circumference * 0.75));

        return (
            <div className="flex flex-col items-center gap-1 group">
                <div className="relative cursor-ns-resize rounded-full p-1"
                    style={{
                        width: knobSize + 8, height: knobSize + 8,
                        background: 'var(--brushed-metal)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.1)'
                    }}
                    onPointerDown={(e) => {
                        const startY = e.clientY;
                        const startVal = value;
                        const handleMove = (me) => {
                            const delta = (startY - me.clientY) * 0.01 * (max - min);
                            onChange(Math.max(min, Math.min(max, startVal + delta)));
                        };
                        const handleUp = () => {
                            window.removeEventListener('pointermove', handleMove);
                            window.removeEventListener('pointerup', handleUp);
                        };
                        window.addEventListener('pointermove', handleMove);
                        window.addEventListener('pointerup', handleUp);
                    }}>
                    <svg width={knobSize} height={knobSize} className="-rotate-[135deg] relative z-10">
                        <circle cx={knobSize / 2} cy={knobSize / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                        <circle cx={knobSize / 2} cy={knobSize / 2} r={radius} fill="none" stroke={color} strokeWidth="4"
                            strokeDasharray={`${circumference} ${circumference}`}
                            style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.1s', filter: `drop-shadow(0 0 3px ${color})` }} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full z-20" style={{ background: color, boxShadow: `0 0 12px ${color}, 0 0 4px #fff` }} />
                        {/* Chrome Cap */}
                        <div className="absolute w-6 h-6 rounded-full opacity-20" style={{ background: 'var(--chrome-finish)' }} />
                    </div>
                </div>
                <div className="text-[8px] font-black uppercase text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-[0.2em]">{label}</div>
            </div>
        );
    };

    // Deck color themes
    const isA = label === 'A';
    const accentColor = isA ? '#00CFFF' : '#CC44FF';
    const deckBg = isA ? '#0B1F33' : '#1A0B33';
    const waveUnplayed = isA ? '#1A3A52' : '#2A1A42';

    // Jog wheel animation
    useEffect(() => {
        let animId;
        const tick = () => {
            if (deckState.isPlaying && !isJogging.current) {
                setRotation(r => (r + (deckState.bpm / 120) * 0.5) % 360);
            }
            animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, [deckState.isPlaying, deckState.bpm]);

    const handleJogStart = (e) => {
        isJogging.current = true;
        setJogActive(true);
        const rect = e.currentTarget.getBoundingClientRect();
        lastAngle.current = Math.atan2(
            e.clientY - (rect.top + rect.height / 2),
            e.clientX - (rect.left + rect.width / 2)
        );
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleJogMove = (e) => {
        if (!isJogging.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const angle = Math.atan2(
            e.clientY - (rect.top + rect.height / 2),
            e.clientX - (rect.left + rect.width / 2)
        );
        let delta = angle - lastAngle.current;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        const deltaDeg = (delta * 180) / Math.PI;
        setRotation(r => (r + deltaDeg) % 360);
        onControlChange('jog', (deltaDeg / 360) * 1.8);
        lastAngle.current = angle;
    };

    const handleJogEnd = (e) => {
        isJogging.current = false;
        setJogActive(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    const formatTime = (t) => {
        if (!t || isNaN(t)) return '00:00.0';
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        const ms = Math.floor((t % 1) * 10);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
    };

    const progressPct = deckState.duration > 0 ? (deckState.currentTime / deckState.duration) * 100 : 0;

    return (
        <div className="relative flex flex-col gap-2 sm:gap-3 min-h-fit sm:h-full rounded-[1.5rem] sm:rounded-[2rem] border p-4 sm:p-5 overflow-hidden shadow-2xl"
            style={{
                background: `linear-gradient(160deg, ${deckBg} 0%, #050E1A 100%)`,
                backdropFilter: 'blur(20px)',
                borderColor: 'rgba(255,255,255,0.08)',
                boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255,255,255,0.1), 0 0 40px ${accentColor}10`
            }}>

            {/* Volumetric Glow Background */}
            <div className="absolute -top-20 -left-20 w-64 h-64 rounded-full blur-[100px] pointer-events-none opacity-20"
                style={{ background: accentColor }} />

            {/* Top: Deck label + BPM + controls */}
            <div className="flex items-center gap-2 flex-wrap">
                <div className="text-lg sm:text-xl font-black italic tracking-tighter"
                    style={{ color: accentColor, textShadow: `0 0 12px ${accentColor}` }}>
                    DECK {label}
                </div>
                <div className="text-[9px] sm:text-[10px] bg-black/60 px-2 py-0.5 sm:py-1 rounded-full font-mono border"
                    style={{ color: accentColor, borderColor: `${accentColor}30` }}>
                    {(deckState.bpm * deckState.tempo).toFixed(1)} BPM
                </div>
                <button
                    onClick={() => onControlChange('sync')}
                    className="text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-bold transition-all border"
                    style={deckState.sync
                        ? { background: '#00FF88', color: '#000', borderColor: '#00FF88', boxShadow: '0 0 12px rgba(0,255,136,0.5)' }
                        : { background: 'rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}>
                    SYNC
                </button>
                <button
                    onClick={() => setTempoRange(p => p === 0.08 ? 0.16 : 0.08)}
                    className="text-[9px] sm:text-[10px] bg-white/8 px-2 py-0.5 sm:py-1 rounded-full font-bold hover:bg-white/15 transition-colors border border-white/8">
                    ±{tempoRange * 100}%
                </button>
                <div className="flex items-center gap-2">
                    {activeFXSlot && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5 border border-white/10 overflow-hidden relative">
                            <div className="absolute inset-0 opacity-20" style={{
                                background: activeFXSlot === 'flanger' ? '#00CFFF' : activeFXSlot === 'phaser' ? '#CC44FF' : activeFXSlot === 'echo' ? '#00FFFF' : '#FFBF00',
                                animation: ['flanger', 'phaser'].includes(activeFXSlot) ? `pulse ${1 / fxState[activeFXSlot].rate}s infinite ease-in-out` : 'none'
                            }} />
                            <Zap size={10} className="z-10" color={
                                activeFXSlot === 'flanger' ? '#00CFFF' :
                                    activeFXSlot === 'phaser' ? '#CC44FF' :
                                        activeFXSlot === 'echo' ? '#00FFFF' : '#FFBF00'
                            } />
                            <span className="text-[9px] font-black uppercase z-10" style={{
                                color: activeFXSlot === 'flanger' ? '#00CFFF' :
                                    activeFXSlot === 'phaser' ? '#CC44FF' :
                                        activeFXSlot === 'echo' ? '#00FFFF' : '#FFBF00'
                            }}>{activeFXSlot}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* NEW: Source Selector Section */}
            <div className="bg-black/40 rounded-xl overflow-hidden border border-white/5">
                <div className="flex h-8 bg-black/20">
                    {['LOCAL', 'STREAM', 'ROOM'].map(tab => (
                        <button key={tab}
                            onClick={() => { setSourceTab(tab); setSourceOpened(true); }}
                            className={`flex-1 flex items-center justify-center gap-1.5 text-[9px] font-black transition-all ${sourceTab === tab ? 'bg-white/10 text-white' : 'text-white/30 hover:text-white/50'}`}
                            style={sourceTab === tab ? { borderBottom: `2px solid ${isA ? '#00CFFF' : '#CC44FF'}` } : {}}>
                            {tab === 'LOCAL' && <FileAudio size={12} />}
                            {tab === 'STREAM' && <Globe size={12} />}
                            {tab === 'ROOM' && <Users size={12} />}
                            {tab}
                        </button>
                    ))}
                    <button onClick={() => setSourceOpened(!sourceOpened)} className="px-3 text-white/20 hover:text-white/40">
                        {sourceOpened ? '▲' : '▼'}
                    </button>
                </div>

                {sourceOpened && (
                    <div className="p-3 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
                        {sourceTab === 'LOCAL' && (
                            <div className="flex flex-col gap-2">
                                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer group">
                                    <input type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files[0]) onLoadFile(e.target.files[0]); }} />
                                    <Upload size={20} className="text-white/20 group-hover:text-white/60 mb-1" />
                                    <span className="text-[10px] uppercase font-black text-white/40">Drop audio or click to browse</span>
                                    <div className="flex gap-1 mt-2">
                                        {['MP3', 'WAV', 'FLAC', 'AAC', 'OGG'].map(b => (
                                            <span key={b} className="bg-white/5 px-1.5 py-0.5 rounded text-[7px] text-white/30 border border-white/5">{b}</span>
                                        ))}
                                    </div>
                                </label>
                                {recentFiles.length > 0 && (
                                    <div className="mt-2">
                                        <div className="flex items-center gap-1.5 text-[8px] font-black text-white/20 mb-1">
                                            <Clock size={10} /> RECENTLY LOADED
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            {recentFiles.slice(0, 5).map((f, i) => (
                                                <button key={i} className="text-left py-1.5 px-2 bg-white/5 rounded-lg text-[9px] text-white/60 hover:bg-white/10 transition-colors truncate">
                                                    {f.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {sourceTab === 'STREAM' && (
                            <div className="flex flex-col gap-3">
                                <div className="text-[10px] font-black text-white/40">ONLINE AUDIO STREAM URL</div>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] text-white focus:outline-none focus:border-white/30"
                                        placeholder="Enter stream URL (Icecast, Radio, etc.)"
                                        value={streamUrl}
                                        onChange={(e) => setStreamUrl(e.target.value)}
                                    />
                                    <button onClick={() => { if (streamUrl) onControlChange('loadStream', streamUrl); }}
                                        className="px-4 py-2 bg-white text-black text-[10px] font-black rounded-lg hover:bg-white/90 transition-all active:scale-95">
                                        LOAD
                                    </button>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button className="flex-1 py-4 bg-black/40 rounded-xl border border-white/5 opacity-50 cursor-not-allowed flex flex-col items-center justify-center grayscale">
                                        <span className="text-[10px] font-black text-white/40">SPOTIFY</span>
                                        <span className="text-[7px] font-black text-white/20 mt-1">COMING SOON</span>
                                    </button>
                                    <button className="flex-1 py-4 bg-black/40 rounded-xl border border-white/5 opacity-50 cursor-not-allowed flex flex-col items-center justify-center grayscale">
                                        <span className="text-[10px] font-black text-white/40">SOUNDCLOUD</span>
                                        <span className="text-[7px] font-black text-white/20 mt-1">COMING SOON</span>
                                    </button>
                                </div>
                            </div>
                        )}
                        {sourceTab === 'ROOM' && (
                            <div className="flex flex-col items-center py-4">
                                <div className="p-4 bg-[#F2C21A]/10 rounded-full border border-[#F2C21A]/30 mb-3">
                                    <Users size={24} color="#F2C21A" />
                                </div>
                                <div className="text-sm font-black text-white mb-1">ROOM TRACK SYNC</div>
                                <div className="text-[10px] font-bold text-white/40 mb-4 text-center">Load the current track playing in this room</div>
                                <button onClick={() => onControlChange('loadRoomTrack')}
                                    className="w-full py-3 bg-[#F2C21A] text-black text-[11px] font-black rounded-xl hover:bg-[#F2C21A]/90 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    LOAD FROM ROOM
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Track info + load (simplified since SourceSelector is present) */}
            <div className="flex flex-col gap-2 items-center">
                {/* Playback time */}
                <div className="font-mono text-xs sm:text-sm font-black px-4 py-1 rounded-full z-10"
                    style={{
                        color: accentColor,
                        background: 'rgba(0,0,0,0.6)',
                        border: `1px solid ${accentColor}30`,
                        boxShadow: `0 0 15px ${accentColor}40`,
                        textShadow: `0 0 8px ${accentColor}`
                    }}>
                    {formatTime(deckState.currentTime)}
                </div>

                <div className="flex flex-col gap-0.5 w-full text-center px-2">
                    <div className="text-[10px] font-bold truncate uppercase tracking-widest"
                        style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {deckState.trackName === 'Load Track' ? 'No track loaded' : deckState.trackName}
                    </div>
                </div>
            </div>
            {/* FX Unit Section */}
            <div className={`mt-2 flex flex-col gap-2 transition-all duration-300 ${fxOpened ? 'flex-1' : ''}`}>
                <div className="flex items-center justify-between px-2 py-1 bg-black/40 rounded-lg border border-white/5">
                    <div className="flex items-center gap-2">
                        <Zap size={14} className={fxOpened ? 'text-[#FFBF00]' : 'text-white/20'} />
                        <span className="text-[10px] font-black tracking-widest text-white/40 uppercase">FX UNIT</span>
                    </div>
                    <button
                        onClick={() => setFXOpened(!fxOpened)}
                        className={`px-3 py-1 rounded text-[9px] font-black transition-all ${fxOpened ? 'bg-[#FFBF00] text-black shadow-lg' : 'bg-white/5 text-white/40 hover:text-white/60'}`}>
                        {fxOpened ? 'CLOSE' : 'OPEN'}
                    </button>
                </div>

                {fxOpened && (
                    <>
                        <div className="flex gap-1">
                            {[
                                { id: 'flanger', label: 'FLANGER', color: '#00CFFF', icon: <Waves size={12} /> },
                                { id: 'phaser', label: 'PHASER', color: '#CC44FF', icon: <RotateCw size={12} /> },
                                { id: 'echo', label: 'ECHO', color: '#00FFFF', icon: <Repeat size={12} /> },
                                { id: 'reverb', label: 'REVERB', color: '#FFBF00', icon: <Home size={12} /> }
                            ].map(fx => (
                                <button key={fx.id}
                                    onClick={() => setActiveFXSlot(activeFXSlot === fx.id ? null : fx.id)}
                                    className={`flex-1 group py-2 rounded-lg border transition-all flex flex-col items-center gap-1 ${activeFXSlot === fx.id ? 'bg-white/10' : 'bg-black/20 hover:bg-white/5'}`}
                                    style={{
                                        borderColor: fxState[fx.id].on ? fx.color : 'rgba(255,255,255,0.05)',
                                        boxShadow: fxState[fx.id].on ? `0 0 10px ${fx.color}40` : 'none'
                                    }}>
                                    <div className="flex items-center gap-1.5">
                                        <span style={{ color: fxState[fx.id].on ? fx.color : 'rgba(255,255,255,0.2)' }}>{fx.icon}</span>
                                        <span className="text-[9px] font-black tracking-tighter" style={{ color: fxState[fx.id].on ? fx.color : 'rgba(255,255,255,0.3)' }}>{fx.label}</span>
                                    </div>
                                    <div className={`w-1.5 h-1.5 rounded-full transition-all ${fxState[fx.id].on ? 'scale-100' : 'scale-0'}`} style={{ background: fx.color, boxShadow: `0 0 8px ${fx.color}` }} />
                                </button>
                            ))}
                        </div>

                        {activeFXSlot && (
                            <div className="p-3 bg-black/20 rounded-lg border border-white/5 animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-md" style={{ background: `${activeFXSlot === 'flanger' ? '#00CFFF' : activeFXSlot === 'phaser' ? '#CC44FF' : activeFXSlot === 'echo' ? '#00FFFF' : '#FFBF00'}22` }}>
                                            {[
                                                activeFXSlot === 'flanger' && <Waves size={14} color="#00CFFF" />,
                                                activeFXSlot === 'phaser' && <RotateCw size={14} color="#CC44FF" />,
                                                activeFXSlot === 'echo' && <Repeat size={14} color="#00FFFF" />,
                                                activeFXSlot === 'reverb' && <Home size={14} color="#FFBF00" />
                                            ]}
                                        </div>
                                        <div className="text-[10px] font-black uppercase tracking-widest text-white/80">{activeFXSlot} UNIT</div>
                                    </div>
                                    <button
                                        onClick={() => toggleFX(activeFXSlot)}
                                        className={`px-4 py-1 rounded-full text-[9px] font-black transition-all ${fxState[activeFXSlot].on ? 'bg-red-500 text-white shadow-lg' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}
                                        style={fxState[activeFXSlot].on ? { boxShadow: '0 0 15px rgba(239,68,68,0.5)' } : {}}>
                                        {fxState[activeFXSlot].on ? 'POWER OFF' : 'POWER ON'}
                                    </button>
                                </div>

                                <div className="flex justify-around items-end h-20 px-2">
                                    {activeFXSlot === 'flanger' && (
                                        <>
                                            <Knob label="RATE" value={fxState.flanger.rate} min={0.1} max={5} onChange={(v) => handleFXParam('flanger', 'rate', v)} color="#00CFFF" />
                                            <Knob label="DEPTH" value={fxState.flanger.depth} min={0.001} max={0.01} onChange={(v) => handleFXParam('flanger', 'depth', v)} color="#00CFFF" />
                                            <Knob label="FEEDBACK" value={fxState.flanger.feedback} min={0} max={0.9} onChange={(v) => handleFXParam('flanger', 'feedback', v)} color="#00CFFF" />
                                            <Knob label="MIX" value={fxState.flanger.mix} min={0} max={1} onChange={(v) => handleFXParam('flanger', 'mix', v)} color="#00CFFF" />
                                        </>
                                    )}
                                    {activeFXSlot === 'phaser' && (
                                        <>
                                            <Knob label="RATE" value={fxState.phaser.rate} min={0.1} max={5} onChange={(v) => handleFXParam('phaser', 'rate', v)} color="#CC44FF" />
                                            <div className="flex flex-col items-center gap-1 group">
                                                <div className="flex gap-1 mb-1">
                                                    {[2, 4, 6, 8].map(s => (
                                                        <button key={s}
                                                            onClick={() => handleFXParam('phaser', 'stages', s)}
                                                            className={`w-5 h-5 rounded flex items-center justify-center text-[7px] font-black border transition-all ${fxState.phaser.stages === s ? 'bg-[#CC44FF] text-white border-[#CC44FF]' : 'bg-black/40 text-white/30 border-white/5'}`}>
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="text-[8px] font-black uppercase text-white/40 group-hover:text-white/60 tracking-widest">STAGES</div>
                                            </div>
                                            <Knob label="RESON" value={fxState.phaser.resonance} min={0.1} max={0.9} onChange={(v) => handleFXParam('phaser', 'resonance', v)} color="#CC44FF" />
                                            <Knob label="MIX" value={fxState.phaser.mix} min={0} max={1} onChange={(v) => handleFXParam('phaser', 'mix', v)} color="#CC44FF" />
                                        </>
                                    )}
                                    {activeFXSlot === 'echo' && (
                                        <>
                                            <Knob label="TIME" value={fxState.echo.time} min={0.05} max={2} onChange={(v) => handleFXParam('echo', 'time', v)} color="#00FFFF" />
                                            <Knob label="FEEDBACK" value={fxState.echo.feedback} min={0} max={0.9} onChange={(v) => handleFXParam('echo', 'feedback', v)} color="#00FFFF" />
                                            <div className="flex flex-col items-center gap-1 group">
                                                <button
                                                    onClick={() => handleFXParam('echo', 'sync', !fxState.echo.sync)}
                                                    className={`px-3 py-1 rounded text-[8px] font-black border transition-all mb-1 ${fxState.echo.sync ? 'bg-yellow-400 text-black border-yellow-400 shadow-lg shadow-yellow-400/20' : 'bg-black/40 text-white/30 border-white/5'}`}>
                                                    SYNC
                                                </button>
                                                <div className="text-[8px] font-black uppercase text-white/40 tracking-widest">BEAT SYNC</div>
                                            </div>
                                            <Knob label="MIX" value={fxState.echo.mix} min={0} max={1} onChange={(v) => handleFXParam('echo', 'mix', v)} color="#00FFFF" />
                                        </>
                                    )}
                                    {activeFXSlot === 'reverb' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-1 mb-1">
                                                {['Room', 'Hall', 'Cathedral', 'Plate', 'Spring'].map(type => (
                                                    <button key={type}
                                                        onClick={() => handleFXParam('reverb', 'type', type)}
                                                        className={`px-2 py-1 rounded text-[7px] font-black border transition-all ${fxState.reverb.type === type ? 'bg-[#FFBF00] text-black border-[#FFBF00]' : 'bg-black/40 text-white/30 border-white/5'}`}>
                                                        {type.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                            <Knob label="MIX" value={fxState.reverb.mix} min={0} max={1} onChange={(v) => handleFXParam('reverb', 'mix', v)} color="#FFBF00" />
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Waveform + seekbar */}
            <div className="flex flex-col gap-1">
                {/* Waveform strip */}
                <div className="h-16 rounded-xl relative border overflow-hidden"
                    style={{ background: '#000', borderColor: `${accentColor}25` }}>

                    {/* Played overlay shadow */}
                    <div className="absolute left-0 top-0 bottom-0 z-10 pointer-events-none"
                        style={{
                            width: `${progressPct}%`,
                            background: `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 100%)`
                        }} />

                    {/* Playhead */}
                    <div className="absolute top-0 bottom-0 w-[2px] z-30 pointer-events-none"
                        style={{
                            left: `${progressPct}%`,
                            background: '#FFF',
                            boxShadow: '0 0 10px #FFF, 0 0 20px #FFF'
                        }} />

                    {deckState.trackName !== 'Load Track' && (
                        <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
                            {Array(80).fill(0).map((_, i) => {
                                const hue = (i / 80) * 360;
                                const isPlayed = (i / 80) * 100 < progressPct;
                                const barHeight = 15 + Math.abs(Math.sin(i * 0.15)) * 55 + Math.random() * 20;
                                return (
                                    <div key={i} className="w-[3px] rounded-full flex-shrink-0"
                                        style={{
                                            height: `${barHeight}%`,
                                            background: `linear-gradient(to bottom, 
                                                hsla(${hue}, 100%, 50%, 0) 0%, 
                                                hsl(${hue}, 100%, 60%) 50%, 
                                                hsla(${hue}, 100%, 50%, 0) 100%)`,
                                            opacity: isPlayed ? 1 : 0.35,
                                            boxShadow: isPlayed ? `0 0 12px hsla(${hue}, 100%, 60%, 0.4)` : 'none',
                                            transition: 'opacity 0.2s'
                                        }} />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Seekbar */}
                <div className="flex flex-col gap-0.5 px-1">
                    <div className="flex justify-between text-[8px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        <span>{formatTime(deckState.currentTime)}</span>
                        <span>{formatTime(deckState.duration)}</span>
                    </div>
                     <input
                        type="range" min="0"
                        max={deckState.duration || 100} step="0.1"
                        value={deckState.currentTime}
                        onChange={(e) => onControlChange('seek', parseFloat(e.target.value))}
                        className="w-full h-1.5 rounded-full appearance-none outline-none hide-thumb cursor-pointer"
                        style={{
                            background: progressPct > 0
                                ? `linear-gradient(to right, 
                                    #FF0000 0%, 
                                    #FF7F00 ${progressPct * 0.2}%, 
                                    #FFFF00 ${progressPct * 0.4}%, 
                                    #00FF00 ${progressPct * 0.6}%, 
                                    #00CFFF ${progressPct * 0.8}%, 
                                    #CC44FF ${progressPct}%, 
                                    rgba(255,255,255,0.08) ${progressPct}%, 
                                    rgba(255,255,255,0.08) 100%)`
                                : 'rgba(255,255,255,0.08)'
                        }}
                    />
                </div>
            </div>

            {/* Jog Wheel + Sliders */}
            <div className={`flex flex-shrink-0 gap-4 items-center justify-between transition-all duration-500 ease-in-out ${otherDeckExpanded ? 'min-h-[280px]' : 'min-h-[160px] sm:min-h-[140px]'}`}>
                {/* Jog Wheel */}
                <div className="flex-1 flex justify-center items-center">
                    <div
                        className="relative rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing group/jog"
                        style={{
                            width: 160, height: 160,
                            background: 'repeating-conic-gradient(#1a1a1a 0 1deg, #111111 1deg 2deg)',
                            border: `8px solid #050505`,
                            boxShadow: jogActive
                                ? `0 0 0 2px ${accentColor}, 0 0 30px ${accentColor}80, 0 10px 40px rgba(0,0,0,0.9)`
                                : `0 10px 40px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.7)`,
                            transform: `rotate(${rotation}deg)`,
                            transition: 'box-shadow 0.2s'
                        }}
                        onPointerDown={handleJogStart}
                        onPointerMove={handleJogMove}
                        onPointerUp={handleJogEnd}
                        onPointerLeave={handleJogEnd}>

                        {/* Holographic Iridescent Vinyl Grooves */}
                        <div className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                            style={{
                                background: 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff, #ff0000)',
                                maskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)',
                                WebkitMaskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)'
                            }} />

                        {/* Glossy Overlay for Vinyl */}
                        <div className="absolute inset-0 rounded-full pointer-events-none"
                            style={{ background: 'var(--glossy-overlay)', opacity: 0.2 }} />

                        <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
                        <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none" />

                        {/* Position Marker */}
                        <div className="absolute top-2 w-1.5 h-6 rounded-full pointer-events-none"
                            style={{ background: '#fff', boxShadow: `0 0 12px #fff, 0 0 20px ${accentColor}` }} />

                        {/* Center Hub (Chrome Finish) */}
                        <div className="w-1/3 h-1/3 rounded-full flex items-center justify-center pointer-events-none relative overflow-hidden"
                            style={{
                                background: 'var(--chrome-finish)',
                                border: '2px solid rgba(255,255,255,0.2)',
                                boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.5)'
                            }}>
                            {/* Hub Reflections */}
                            <div className="absolute inset-0 bg-white/10 blur-[2px] -rotate-45 translate-x-1/2" />
                            <div className="text-[12px] font-black italic z-10" style={{ color: '#000', textShadow: '0 1px 0 rgba(255,255,255,0.5)' }}>{label}</div>
                        </div>
                    </div>
                </div>

                {/* Vertical Sliders */}
                <div className="flex gap-3 h-full py-1">
                    <VerticalSlider
                        label="TEMPO"
                        min={1 - tempoRange} max={1 + tempoRange}
                        value={deckState.tempo}
                        unit="%"
                        onChange={(v) => onControlChange('tempo', v)}
                        resetValue={1.0}
                        color="#F2C21A"
                    />
                    <VerticalSlider
                        label="PITCH"
                        min={-6} max={6}
                        value={deckState.pitch}
                        unit=""
                        onChange={(v) => onControlChange('pitch', v)}
                        resetValue={0}
                        color={accentColor}
                    />
                </div>
            </div>

            {/* Transport + Hot Cues */}
            <div className="flex flex-col gap-2.5 mt-1">
                {/* Play/Cue buttons */}
                <div className="flex gap-2">
                    <button
                        className="flex-1 py-3.5 text-sm font-black rounded-xl border transition-all active:scale-95"
                        style={deckState.cue
                            ? { background: '#F2C21A', color: '#000', borderColor: '#F2C21A', boxShadow: '0 0 18px rgba(242,194,26,0.5)' }
                            : { background: 'rgba(0,0,0,0.3)', borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.3)' }}
                        onMouseDown={() => { onControlChange('cue', true); onControlChange('play', true); }}
                        onMouseUp={() => { onControlChange('cue', false); onControlChange('play', false); }}>
                        CUE
                    </button>
                    <button
                        className="flex-1 py-3.5 text-sm font-black rounded-xl border transition-all active:scale-95"
                        style={deckState.isPlaying
                            ? { background: '#00FF88', color: '#000', borderColor: '#00FF88', boxShadow: '0 0 18px rgba(0,255,136,0.5)' }
                            : { background: `${accentColor}15`, borderColor: `${accentColor}40`, color: accentColor }}
                        onClick={() => onControlChange('play', !deckState.isPlaying)}>
                        {deckState.isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
                    </button>
                </div>

                {/* Hot Cue Pads 1–8 */}
                <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <HotCuePad
                            key={i}
                            index={i}
                            cueTime={deckState.hotcues[i]}
                            deckLabel={label}
                            onSet={() => onControlChange('hotcue', i, 'set')}
                            onJump={() => onControlChange('hotcue', i, 'jump')}
                            onClear={() => onControlChange('hotcue', i, 'clear')}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
