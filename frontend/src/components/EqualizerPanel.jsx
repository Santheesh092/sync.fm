import { useState, useEffect } from 'react';
import { EQ_BANDS, EQ_PRESETS, applyEQGains } from '../lib/effectUtils';
import VerticalSlider from './dj/VerticalSlider';

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

const BAND_GRADIENTS = [
    'linear-gradient(to top, #FF4444CC, #FF8C00AA)',
    'linear-gradient(to top, #FF8C00CC, #F2C21AAA)',
    'linear-gradient(to top, #F2C21ACC, #A3FF00AA)',
    'linear-gradient(to top, #A3FF00CC, #00FF88AA)',
    'linear-gradient(to top, #00FF88CC, #00CFFFAA)',
    'linear-gradient(to top, #00CFFFC0, #3B82F6AA)',
    'linear-gradient(to top, #3B82F6CC, #CC44FFAA)',
    'linear-gradient(to top, #CC44FFCC, #FF44FFAA)',
    'linear-gradient(to top, #FF44FFCC, #FF44BBAA)',
    'linear-gradient(to top, #FF44BBCC, #FFFFFF88)',
];

export default function EqualizerPanel({ filters }) {
    const [activePreset, setActivePreset] = useState('flat');
    const [gains, setGains] = useState(new Array(10).fill(0));

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

    const formatFreq = (hz) => hz >= 1000 ? `${hz / 1000}k` : `${hz}`;

    return (
        <div className="p-2 sm:p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-xl w-full max-w-full overflow-hidden">
            {/* Preset Row */}
            <div className="flex gap-1.5 sm:gap-2 flex-wrap mb-6 sm:mb-10 justify-center max-w-full overflow-hidden px-1">
                {PRESET_LABELS.map(p => (
                    <button key={p.key} onClick={() => applyPreset(p.key)}
                        className={`px-3 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all duration-300 border ${activePreset === p.key ? 'bg-[#F2C21A]/15 text-[#F2C21A] border-[#F2C21A]/40' : 'bg-white/5 text-white/40 border-white/5 hover:bg-white/10 hover:text-white/60'}`}
                        style={{
                            boxShadow: activePreset === p.key ? `0 0 20px rgba(242, 194, 26, 0.1)` : 'none'
                        }}>
                        {p.label}
                    </button>
                ))}
            </div>
 
            {/* EQ Sliders */}
            <div className="flex items-stretch justify-between gap-0.5 sm:gap-4 h-48 sm:h-64 px-1 max-w-full">
                {EQ_BANDS.map((freq, i) => (
                    <div key={freq} className="flex flex-col items-center gap-1 sm:gap-3 flex-1 h-full min-w-0 overflow-hidden">
                        {/* Gain value */}
                        <span className="text-[8px] sm:text-[10px] font-mono font-bold truncate"
                            style={{ 
                                color: gains[i] > 0 ? BAND_COLORS[i] : gains[i] < 0 ? '#6b8fa8' : 'rgba(232, 244, 253, 0.5)',
                                textShadow: gains[i] !== 0 ? `0 0 8px ${BAND_COLORS[i]}44` : 'none'
                            }}>
                            {gains[i] > 0 ? '+' : ''}{gains[i].toFixed(0)}
                        </span>
                        
                        {/* Vertical Slider */}
                        <div className="flex-1 w-full flex justify-center py-1 sm:py-2">
                            <VerticalSlider
                                min={-12}
                                max={12}
                                value={gains[i]}
                                onChange={v => handleBandChange(i, v)}
                                color={BAND_COLORS[i]}
                                gradient={BAND_GRADIENTS[i]}
                                showTicks={true}
                                resetValue={0}
                            />
                        </div>

                        {/* Frequency label - Vertical on very small screens? No, just very small font */}
                        <span className="text-[7px] sm:text-[9px] font-black tracking-tighter uppercase opacity-40 group-hover:opacity-100 transition-opacity truncate" style={{ color: BAND_COLORS[i] }}>
                            {formatFreq(freq)}
                        </span>
                    </div>
                ))}
            </div>

            {/* dB scale hint */}
            <div className="flex justify-between items-center text-[7px] sm:text-[8px] font-black uppercase tracking-widest mt-4 sm:mt-6 px-2 sm:px-4 py-1.5 sm:py-2 bg-white/5 rounded-full border border-white/5" style={{ color: 'rgba(107, 143, 168, 0.6)' }}>
                <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-blue-400/50"/> -12</span>
                <span className="flex items-center gap-1 font-mono text-[8px] sm:text-[10px] text-white/40">CENTER 0dB</span>
                <span className="flex items-center gap-1"><div className="w-1 h-1 rounded-full bg-red-400/50"/> +12</span>
            </div>
        </div>
    );
}
