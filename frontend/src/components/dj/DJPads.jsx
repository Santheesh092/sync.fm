import { useState, useEffect } from 'react';
import { SAMPLE_BANKS, playSample, precalculateAllSamples } from '../../lib/djSamples';
import { 
    Music, Wind, Zap, Aperture, 
    Play, Square, Radio, Waves,
    Volume2, Activity, Layers, Disc,
    Sparkles, Rocket, Ghost, Cpu,
    Dribbble, CloudRain, Star, Sun
} from 'lucide-react';

// Color & Icon mapping for samples
const SAMPLE_STYLES = {
    // Bank A
    horn: { color: '#FF4444', icon: <Volume2 size={16} /> },
    drum: { color: '#FF8C00', icon: <Activity size={16} /> },
    scratch: { color: '#00CFFF', icon: <Disc size={16} /> },
    bass: { color: '#FF4444', icon: <Layers size={16} /> },
    echo: { color: '#00FF88', icon: <Waves size={16} /> },
    sweep: { color: '#CC44FF', icon: <Zap size={16} /> },
    siren: { color: '#FF4444', icon: <Radio size={16} /> },
    cymbal: { color: '#F2C21A', icon: <Music size={16} /> },
    rewind: { color: '#00CFFF', icon: <Activity size={16} /> },
    crowd: { color: '#00FF88', icon: <Aperture size={16} /> },
    laser: { color: '#CC44FF', icon: <Zap size={16} /> },
    vinyl: { color: '#F2C21A', icon: <Disc size={16} /> },
    alarm: { color: '#FF4444', icon: <Radio size={16} /> },
    foghorn: { color: '#FF8C00', icon: <Volume2 size={16} /> },
    clap: { color: '#00FF88', icon: <Music size={16} /> },
    snare: { color: '#FF4444', icon: <Activity size={16} /> },
    
    // Bank B
    pulse: { color: '#FF8C00', icon: <Activity size={16} /> },
    glitch: { color: '#00CFFF', icon: <Cpu size={16} /> },
    orbit: { color: '#CC44FF', icon: <Rocket size={16} /> },
    warp: { color: '#00FF88', icon: <Ghost size={16} /> },
    shimmer: { color: '#F2C21A', icon: <Sparkles size={16} /> },
    impact: { color: '#FF4444', icon: <Layers size={16} /> },
    spark: { color: '#CC44FF', icon: <Zap size={16} /> },
    drone: { color: '#00CFFF', icon: <Waves size={16} /> },
    alien: { color: '#00FF88', icon: <Ghost size={16} /> },
    beam: { color: '#00CFFF', icon: <Rocket size={16} /> },
    crush: { color: '#CC44FF', icon: <Dribbble size={16} /> },
    echo2: { color: '#00FF88', icon: <CloudRain size={16} /> },
    noise2: { color: '#6b8fa8', icon: <Aperture size={16} /> },
    ping: { color: '#00CFFF', icon: <Star size={16} /> },
    rev_kick: { color: '#FF8C00', icon: <Activity size={16} /> },
    wobble: { color: '#F2C21A', icon: <Sun size={16} /> },

    default: { color: '#6b8fa8', icon: <Layers size={16} /> }
};

export default function DJPads({ audioContext, destination }) {
    const [activePads, setActivePads] = useState({});
    const [bank, setBank] = useState(0);

    // Initialize samples on mount
    useEffect(() => {
        if (audioContext) {
            precalculateAllSamples(audioContext);
        }
    }, [audioContext]);

    const handlePadDown = async (padIndex, sampleId) => {
        if (!audioContext || !destination) return;
        
        // Ensure context is running (required for many browsers)
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        
        playSample(audioContext, destination, sampleId);
        setActivePads(prev => ({ ...prev, [padIndex]: true }));
    };

    const handlePadUp = (padIndex) => {
        setActivePads(prev => ({ ...prev, [padIndex]: false }));
    };

    const currentBank = SAMPLE_BANKS[bank];
    const padList = [...currentBank.samples];
    while(padList.length < 16) {
        padList.push({ id: `empty-${padList.length}`, label: '', synthFreq: 0 });
    }

    return (
        <div className="p-4 sm:p-6 rounded-3xl border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] w-full overflow-hidden relative"
             style={{ background: 'var(--brushed-metal)' }}>
            
            {/* Glossy Overlay for the entire sampler */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{ background: 'var(--glossy-overlay)' }} />

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#00CFFF]/5 blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#CC44FF]/5 blur-[100px] pointer-events-none" />

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 relative z-10">
                <div className="flex flex-col">
                    <div className="text-[10px] font-black text-white/40 tracking-[0.3em] uppercase mb-1">Performance Interface</div>
                    <div className="text-xl font-black text-white italic tracking-tighter">
                        SAMPLER <span className="text-[#F2C21A]">{currentBank.name.toUpperCase()}</span>
                    </div>
                </div>

                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 self-stretch sm:self-auto">
                    {SAMPLE_BANKS.map((b, i) => (
                        <button key={i} 
                                className={`flex-1 sm:flex-none px-4 py-2 text-[10px] font-black rounded-lg transition-all ${bank === i ? 'bg-[#F2C21A] text-black shadow-lg shadow-[#F2C21A]/20' : 'text-white/30 hover:text-white/60'}`}
                                onClick={() => setBank(i)}>
                            BANK {b.id}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3 relative z-10">
                {padList.map((pad, i) => {
                    const isActive = activePads[i];
                    const style = SAMPLE_STYLES[pad.id] || SAMPLE_STYLES.default;
                    const isEmpty = !pad.label;
                    
                    return (
                        <button key={i}
                             className={`group relative aspect-square rounded-xl sm:rounded-2xl transition-all duration-75 flex flex-col items-center justify-center gap-1 sm:gap-2 overflow-hidden border ${isEmpty ? 'opacity-10 pointer-events-none' : ''}`}
                             style={{
                                background: isActive ? style.color : 'rgba(0,0,0,0.4)',
                                borderColor: isActive ? style.color : 'rgba(255,255,255,0.03)',
                                boxShadow: isActive 
                                    ? `0 0 30px ${style.color}CC, inset 0 0 15px ${style.color}, 0 0 10px #fff` 
                                    : 'inset 0 4px 6px rgba(0,0,0,0.5)',
                                transform: isActive ? 'scale(0.95)' : 'scale(1)',
                             }}
                             onPointerDown={(e) => { e.preventDefault(); handlePadDown(i, pad.id); }}
                             onPointerUp={() => handlePadUp(i)}
                             onPointerLeave={() => handlePadUp(i)}>
                            
                            {/* Glossy Pad Surface */}
                            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ background: 'var(--glossy-overlay)' }} />

                            {/* Glow fill on click */}
                            {isActive && (
                                <div className="absolute inset-0 bg-white/30 blur-md animate-pulse" />
                            )}
                            
                            <div className={`transition-all duration-75 relative z-10 ${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]' : 'group-hover:scale-110'}`}
                                 style={{ color: isActive ? '#fff' : style.color }}>
                                {style.icon}
                            </div>
                            
                            <span className={`text-[7px] sm:text-[9px] font-black uppercase text-center leading-tight transition-colors relative z-10 tracking-widest ${isActive ? 'text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-white/20 group-hover:text-white/60'}`}>
                                {pad.label}
                            </span>

                            {/* Premium LED Corner indicator */}
                            {!isEmpty && (
                                <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-1 sm:h-1.5 sm:w-1.5 h-1 rounded-full z-20" 
                                     style={{ 
                                        background: isActive ? '#fff' : style.color, 
                                        boxShadow: isActive ? `0 0 10px #fff` : `0 0 5px ${style.color}, inset 0 0 2px rgba(255,255,255,0.5)` 
                                     }} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
