import { useState } from 'react';
import { EAR_MODES, applyEQGains } from '../lib/effectUtils';

export default function EarModePanel({ filters }) {
    const [activeMode, setActiveMode] = useState(null);

    const handleSelect = (modeKey) => {
        const isToggleOff = activeMode === modeKey;
        setActiveMode(isToggleOff ? null : modeKey);
        if (filters) {
            const gains = isToggleOff ? new Array(10).fill(0) : EAR_MODES[modeKey].gains;
            applyEQGains(filters, gains);
        }
    };

    const EAR_MODE_COLORS = {
        under30: 'var(--ear-under30)',
        age30to60: 'var(--ear-30to60)',
        above60: 'var(--ear-above60)',
    };

    return (
        <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <div className="text-xl">🎧</div>
                </div>
                <div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-white/90">Personalized Hearing</h3>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Ear Customized Mode • Dynamic Profiles</p>
                </div>
            </div>

            <div className="ear-mode-grid">
                {Object.entries(EAR_MODES).map(([key, mode]) => {
                    const isActive = activeMode === key;
                    return (
                        <button 
                            key={key} 
                            onClick={() => handleSelect(key)}
                            className={`ear-mode-card ${isActive ? 'active' : ''}`}
                            data-mode={key}
                        >
                            <div className="ear-mode-emoji">{mode.emoji}</div>
                            <div className="ear-mode-label">{mode.label}</div>
                            <div className="ear-mode-desc">{mode.description}</div>
                            
                            <div className="gain-preview-container">
                                {mode.gains.map((g, i) => (
                                    <div key={i}
                                        className="gain-bar"
                                        style={{
                                            height: `${Math.max(15, ((g + 12) / 24) * 100)}%`,
                                        }}
                                    />
                                ))}
                            </div>
                        </button>
                    );
                })}
            </div>

            {activeMode && (
                <div className="mt-8 p-4 rounded-xl glass-panel animate-slide-up flex items-center gap-3" 
                     style={{ borderLeft: `4px solid ${EAR_MODE_COLORS[activeMode]}` }}>
                    <div className="p-2 rounded-lg bg-white/5">
                        <span className="text-xl">✨</span>
                    </div>
                    <div>
                        <div className="font-black text-[10px] uppercase tracking-widest" style={{ color: EAR_MODE_COLORS[activeMode] }}>
                            {EAR_MODES[activeMode].label} Profile Active
                        </div>
                        <div className="text-xs font-medium text-white/60">{EAR_MODES[activeMode].description}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
