import { useState } from 'react';
import { EFFECTS, applyEffect } from '../lib/effectUtils';

export default function EffectsPanel({ audioNodes, onInitAudio }) {
    const [activeEffect, setActiveEffect] = useState('none');

    const handleEffectSelect = (effectId) => {
        setActiveEffect(effectId);
        
        // If nodes aren't initialized yet (audio context hasn't been started), initialize them first
        if (!audioNodes || !audioNodes.eqOutput) {
            if (onInitAudio) {
                onInitAudio();
            }
        }
        
        // Use a small timeout to allow state/refs to update if we just initialized them
        setTimeout(() => {
            if (audioNodes) {
                applyEffect(null, effectId, audioNodes);
            }
        }, 50);
    };

    return (
        <div className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider mb-5" style={{ color: '#6b8fa8', opacity: 0.8 }}>
                Select Audio Environment
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {EFFECTS.map(effect => (
                    <button
                        key={effect.id}
                        data-effect={effect.id}
                        onClick={() => handleEffectSelect(effect.id)}
                        className={`effect-card ${activeEffect === effect.id ? 'active' : ''}`}
                    >
                        <div className="text-3xl mb-3 transition-transform duration-300 group-hover:scale-110">{effect.emoji}</div>
                        <div className="font-bold text-sm tracking-tight">{effect.label}</div>
                        <div className="text-[10px] mt-1 font-medium opacity-60 px-1">{effect.desc}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}
