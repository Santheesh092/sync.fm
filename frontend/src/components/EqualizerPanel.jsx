import { useState, useEffect, useRef } from 'react';
import { EQ_BANDS, EQ_PRESETS, applyEQGains } from '../lib/effectUtils';
import EQSlider from './dj/EQSlider';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Zap, Sliders, ChevronRight } from 'lucide-react';

const PRESET_LABELS = [
    { key: 'flat', label: 'Flat' },
    { key: 'jazz', label: 'Jazz' },
    { key: 'pop', label: 'Pop' },
    { key: 'rock', label: 'Rock' },
    { key: 'club', label: 'Club' },
    { key: 'powerful', label: 'Powerful' },
    { key: 'dance', label: 'Dance' },
    { key: 'techno', label: 'Techno' },
    { key: 'bassboost', label: 'Bass++' },
    { key: 'vocal', label: 'Vocal' },
    { key: 'custom', label: 'Custom' },
];

const BAND_COLORS = [
    '#FF4444', // 31
    '#FF8C00', // 62
    '#F2C21A', // 125
    '#A3FF00', // 250
    '#00FF88', // 500
    '#00CFFF', // 1k
    '#3B82F6', // 2k
    '#CC44FF', // 4k
    '#FF44FF', // 8k
    '#FF44BB', // 16k
];

// Indices for 5-band mode (approx: 62, 250, 1k, 4k, 16k)
const BASIC_BAND_INDICES = [1, 3, 5, 7, 9];

export default function EqualizerPanel({ filters }) {
    const [activePreset, setActivePreset] = useState('flat');
    const [gains, setGains] = useState(new Array(10).fill(0));
    const [mode, setMode] = useState('advanced'); // 'basic' or 'advanced'
    const scrollRef = useRef(null);

    // Apply gains to Web Audio API filters
    useEffect(() => {
        if (filters && filters.length === 10) {
            applyEQGains(filters, gains);
        }
    }, [gains, filters]);

    const applyPreset = (key) => {
        setActivePreset(key);
        if (key === 'custom') return;
        const presetGains = EQ_PRESETS[key] || new Array(10).fill(0);
        setGains([...presetGains]);
    };

    const handleBandChange = (index, value) => {
        setActivePreset('custom');
        setGains(prev => {
            const next = [...prev];
            next[index] = parseFloat(value);
            return next;
        });
    };

    const handleReset = () => {
        setActivePreset('flat');
        setGains(new Array(10).fill(0));
    };

    const formatFreq = (hz) => hz >= 1000 ? `${hz / 1000}k` : `${hz}`;

    const displayedIndices = mode === 'basic' ? BASIC_BAND_INDICES : Array.from({ length: 10 }, (_, i) => i);

    return (
        <div className="relative p-3 sm:p-6 bg-[#050E1A]/80 rounded-[2rem] border border-white/10 backdrop-blur-3xl w-full max-w-full overflow-hidden shadow-2xl">
            {/* Header / Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        <Sliders size={18} className="text-[#F2C21A]" />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm sm:text-base tracking-tight">Equalizer</h3>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">10-Band Studio Grade</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleReset}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                        title="Reset EQ"
                    >
                        <RefreshCw size={14} />
                    </button>
                    
                    <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 shadow-inner">
                        <button 
                            onClick={() => setMode('basic')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${mode === 'basic' ? 'bg-[#F2C21A] text-black shadow-lg shadow-[#F2C21A]/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Basic
                        </button>
                        <button 
                            onClick={() => setMode('advanced')}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${mode === 'advanced' ? 'bg-[#F2C21A] text-black shadow-lg shadow-[#F2C21A]/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Advanced
                        </button>
                    </div>
                </div>
            </div>

            {/* Presets - Wrapped on Desktop/Tablet, Scrollable on Mobile */}
            <div className="mb-8 relative group">
                <div className="flex gap-2 flex-wrap justify-center sm:flex-nowrap sm:overflow-x-auto no-scrollbar pb-2 px-1 mask-fade-right">
                    {PRESET_LABELS.map(p => (
                        <button 
                            key={p.key} 
                            onClick={() => applyPreset(p.key)}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-full transition-all duration-300 border whitespace-nowrap ${activePreset === p.key ? 'bg-[#F2C21A] text-black border-transparent shadow-lg shadow-[#F2C21A]/20 scale-105' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/60'}`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-[#050E1A]/80 to-transparent pointer-events-none sm:hidden" />
            </div>
 
            {/* EQ Sliders Container */}
            <div className="relative bg-black/20 rounded-3xl p-2 sm:p-4 border border-white/5 shadow-inner">
                <div 
                    ref={scrollRef}
                    className="flex items-stretch justify-between gap-1 sm:gap-6 h-64 sm:h-80 px-1 sm:px-4"
                >
                    <AnimatePresence mode="popLayout">
                        {displayedIndices.map((i) => {
                            const freq = EQ_BANDS[i];
                            return (
                                <motion.div 
                                    key={freq}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 10 }}
                                    transition={{ duration: 0.3, delay: i * 0.02 }}
                                    className="flex flex-col items-center gap-4 flex-1 h-full min-w-0"
                                >
                                    <EQSlider
                                        min={-12}
                                        max={12}
                                        value={gains[i]}
                                        onChange={v => handleBandChange(i, v)}
                                        color={BAND_COLORS[i]}
                                        label={formatFreq(freq)}
                                        unit="dB"
                                        resetValue={0}
                                    />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Footer / Info */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 text-[9px] font-bold text-white/20 uppercase tracking-widest">
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#FF4444] shadow-[0_0_8px_#FF4444]" /> BASS</span>
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#F2C21A] shadow-[0_0_8px_#F2C21A]" /> MID</span>
                    <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] shadow-[0_0_8px_#00CFFF]" /> HIGH</span>
                </div>
                
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    <Zap size={12} className="text-[#F2C21A] animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-[#F2C21A]/80 tracking-tight">REAL-TIME PROCESSING ACTIVE</span>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .mask-fade-right {
                    mask-image: linear-gradient(to right, black 85%, transparent 100%);
                }
            `}} />
        </div>
    );
}
