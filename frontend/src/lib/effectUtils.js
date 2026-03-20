/**
 * Vibez.fm — Effect Utilities & EQ Presets
 * Web Audio API node factories for effects and equalizer bands
 */

// ─── EQ Frequency Bands ────────────────────────────────────────────────────
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// ─── EQ Presets (dB gains for each band) ──────────────────────────────────
export const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    jazz: [0, 0, 0, +2, +4, +4, +3, +2, +2, +1],
    pop: [-1, -1, 0, +2, +4, +4, +2, 0, -1, -1],
    rock: [+4, +3, +2, +1, 0, -1, +1, +3, +4, +4],
    classical: [0, 0, 0, +2, +3, +3, +2, +2, +2, +3],
    electronic: [+4, +3, +1, 0, -1, +1, +2, +2, +3, +4],
    bassboost: [+10, +9, +7, +4, +2, 0, 0, 0, 0, 0],
    vocal: [-2, -2, 0, +3, +5, +5, +4, +2, +1, 0],
    powerful: [+7, +6, +4, +2, 0, +2, +4, +6, +7, +8],
    club: [+8, +7, +5, +2, 0, +1, +3, +5, +7, +9],
    dance: [+6, +5, +3, 0, -1, 0, +2, +4, +6, +7],
    techno: [+9, +8, +5, +2, 0, +1, +3, +5, +7, +8],
};

// ─── Ear Mode Presets ──────────────────────────────────────────────────────
export const EAR_MODES = {
    under30: {
        label: 'Under 30',
        emoji: '🎧',
        description: 'Flat + bright highs',
        gains: [0, 0, 0, 0, 0, 0, +1, +2, +3, +4],
    },
    age30to60: {
        label: '30–60 Years',
        emoji: '🎵',
        description: 'Balanced mids, speech clarity',
        gains: [0, 0, +1, +2, +3, +2, +1, 0, -1, -2],
    },
    above60: {
        label: '60+ Years',
        emoji: '🔊',
        description: 'Vocal boost, reduced high fatigue',
        gains: [0, +1, +2, +4, +5, +4, +2, 0, -3, -6],
    },
};

// ─── Create EQ Filter Chain ────────────────────────────────────────────────
export function createEQChain(ctx) {
    const filters = EQ_BANDS.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === EQ_BANDS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = 0;
        filter.Q.value = 1.0;
        return filter;
    });
    
    // Connect them in series
    for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
    }
    
    return filters;
}

export function applyEQGains(filters, gains) {
    const now = filters[0]?.context.currentTime || 0;
    const timeConstant = 0.1; // Smoothness factor
    filters.forEach((f, i) => {
        if (gains[i] !== undefined) {
            f.gain.setTargetAtTime(gains[i], now, timeConstant);
        }
    });
}

// ─── Effect Definitions ────────────────────────────────────────────────────
export const EFFECTS = [
    { id: 'none', emoji: '🔮', label: 'Flat / Off', desc: 'No processing' },
    { id: 'megabass', emoji: '🔊', label: 'Mega Bass', desc: 'Deep low-end boost' },
    { id: 'studio', emoji: '🎙️', label: 'Studio Resolve', desc: 'Crystal clear, professional refinement' },
    { id: 'concert', emoji: '🎭', label: 'Concert Hall', desc: 'Rich, airy live reverb' },
    { id: 'stadium', emoji: '🏟️', label: 'Grand Stadium', desc: 'Massive scale with long-tail echo' },
    { id: 'jazz', emoji: '🎷', label: 'Jazz Club', desc: 'Warm, intimate woody ambiance' },
    { id: 'nightclub', emoji: '🌙', label: 'Night Club', desc: 'High-energy punchy compression' },
    { id: 'lofi', emoji: '📻', label: 'Lofi Radio', desc: 'Vintage bandwidth-limited vibes' },
    { id: 'library', emoji: '📚', label: 'Quiet Library', desc: 'Muffled, cozy low-pass tone' },
    { id: 'cinema', emoji: '🎬', label: 'Cinema XL', desc: 'Dramatic, wide immersive stereo' },
];

// ─── Dimension Definitions ────────────────────────────────────────────────
export const DIMENSIONS = [
    { id: '2d', label: '2D Audio', emoji: '📐', desc: 'Stereo width enhancement', panning: 'fixed', reverb: 0.1 },
    { id: '3d', label: '3D Audio', emoji: '🧊', desc: 'Spatial depth simulation', panning: 'fixed', reverb: 0.25 },
    { id: '4d', label: '4D Audio', emoji: '🌪️', desc: 'Auto-panning + movement', panning: 'lfo-slow', reverb: 0.3 },
    { id: '6d', label: '6D Audio', emoji: '🌌', desc: 'Rotational spatialization', panning: 'lfo-med', reverb: 0.4 },
    { id: '8d', label: '8D Audio', emoji: '🌀', desc: 'Immersive circular panning', panning: 'lfo-fast', reverb: 0.5 },
    { id: '9d', label: '9D Audio', emoji: '🌈', desc: 'Multilayered spatial depth', panning: 'lfo-fast', reverb: 0.6 },
    { id: '16d', label: '16D Audio', emoji: '🛸', desc: 'Complex orbital movement', panning: 'lfo-dynamic', reverb: 0.75 },
    { id: '24d', label: '24D Audio', emoji: '☄️', desc: 'Hyper-spatial resolution', panning: 'lfo-dynamic', reverb: 0.85 },
    { id: '36d', label: '36D Audio', emoji: '✨', desc: 'Infinite dimensional soundstage', panning: 'lfo-dynamic', reverb: 1.0 },
];

// ─── Impulse Response Cache ───────────────────────────────────────────────
const impulseCache = new Map();

function getImpulseResponse(ctx, type) {
    const key = `${ctx.sampleRate}-${type}`;
    if (impulseCache.has(key)) return impulseCache.get(key);

    const impulse = createImpulseResponse(ctx, type);
    impulseCache.set(key, impulse);
    return impulse;
}

// ─── Generate simple Impulse Responses for Convolvers ──────────────────────
function createImpulseResponse(ctx, type) {
    const rate = ctx.sampleRate;
    let length, decay;

    if (type === 'hall') {
        length = rate * 3.0; 
        decay = 1.8;
    } else if (type === 'stadium') {
        length = rate * 5.5; 
        decay = 1.2;
    } else if (type === 'jazz') {
        length = rate * 1.5; 
        decay = 4.5;
    } else if (type === 'room') {
        length = rate * 0.8; 
        decay = 6.0;
    } else {
        length = rate * 0.5;
        decay = 10.0;
    }

    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    let lpL = 0, lpR = 0;
    for (let i = 0; i < length; i++) {
        const n = i / length;
        const amp = Math.pow(1 - n, decay);
        
        // Raw white noise
        const rL = (Math.random() * 2 - 1);
        const rR = (Math.random() * 2 - 1);
        
        // One-pole lowpass filter that gets stronger over time 
        // (simulating high-frequency absorption)
        const alpha = Math.max(0.005, 0.9 * Math.pow(1 - n, 2)); 
        lpL = lpL + alpha * (rL - lpL);
        lpR = lpR + alpha * (rR - lpR);
        
        left[i] = lpL * amp;
        right[i] = lpR * amp;
    }
    return impulse;
}

// ─── Apply Effect to Audio Graph ──────────────────────────────────────────
export function applyEffect(ctx, effectId, nodes) {
    if (!nodes || !nodes.eqOutput) {
        console.warn('[effectUtils] Audio nodes missing! Cannot apply effect:', effectId);
        return;
    }
    console.log(`[effectUtils] Applying effect: ${effectId}`);

    const { 
        eqOutput, analyser, effectFilter, panner, 
        compressor, delay, convolver, effectGain 
    } = nodes;

    const now = ctx?.currentTime || 0;
    const tc = 0.05; // Quick but smooth

    try {
        // 1. Disconnect everything from EQ Output onwards
        eqOutput.disconnect();
        effectFilter.disconnect();
        panner.disconnect();
        compressor.disconnect();
        delay.disconnect();
        convolver.disconnect();
        effectGain.disconnect();
    } catch (e) {
        console.warn('[effectUtils] Disconnect error', e);
    }
    
    // Default resets for the nodes
    effectFilter.type = 'peaking';
    effectFilter.gain.setTargetAtTime(0, now, tc);
    effectFilter.frequency.setTargetAtTime(1000, now, tc);
    effectFilter.Q.setTargetAtTime(1, now, tc);
    
    panner.pan.setTargetAtTime(0, now, tc);
    
    compressor.threshold.setTargetAtTime(-24, now, tc);
    compressor.knee.setTargetAtTime(30, now, tc);
    compressor.ratio.setTargetAtTime(4, now, tc);
    compressor.attack.setTargetAtTime(0.003, now, tc);
    compressor.release.setTargetAtTime(0.25, now, tc);
    
    delay.delayTime.setTargetAtTime(0, now, tc);
    effectGain.gain.setTargetAtTime(1.0, now, tc);

    // Helper to connect a linear chain
    const routeChain = (...chain) => {
        let current = eqOutput;
        for (const n of chain) {
            current.connect(n);
            current = n;
        }
        current.connect(analyser); // Always end at the analyser
    };

    switch (effectId) {
        case 'megabass':
            effectFilter.type = 'lowshelf';
            effectFilter.frequency.setTargetAtTime(85, now, tc);
            effectFilter.gain.setTargetAtTime(12, now, tc);
            routeChain(effectFilter);
            break;

        case 'studio':
            effectFilter.type = 'peaking';
            effectFilter.frequency.setTargetAtTime(3200, now, tc);
            effectFilter.gain.setTargetAtTime(2.5, now, tc);
            effectFilter.Q.setTargetAtTime(1.0, now, tc);
            compressor.threshold.setTargetAtTime(-18, now, tc);
            compressor.ratio.setTargetAtTime(2.5, now, tc);
            compressor.knee.setTargetAtTime(12, now, tc);
            routeChain(effectFilter, compressor);
            break;

        case 'concert':
            convolver.buffer = createImpulseResponse(ctx, 'hall');
            eqOutput.connect(analyser);
            eqOutput.connect(convolver);
            effectGain.gain.setTargetAtTime(0.7, now, tc);
            convolver.connect(effectGain);
            effectGain.connect(analyser);
            break;

        case 'stadium':
            convolver.buffer = createImpulseResponse(ctx, 'stadium');
            delay.delayTime.setTargetAtTime(0.15, now, tc);
            eqOutput.connect(analyser);
            eqOutput.connect(delay);
            delay.connect(convolver);
            effectGain.gain.setTargetAtTime(0.6, now, tc);
            convolver.connect(effectGain);
            effectGain.connect(analyser);
            break;

        case 'jazz':
            convolver.buffer = createImpulseResponse(ctx, 'jazz');
            effectFilter.type = 'lowpass';
            effectFilter.frequency.setTargetAtTime(4500, now, tc);
            eqOutput.connect(effectFilter);
            effectFilter.connect(analyser);
            effectFilter.connect(convolver);
            effectGain.gain.setTargetAtTime(0.4, now, tc);
            convolver.connect(effectGain);
            effectGain.connect(analyser);
            break;

        case 'nightclub':
            effectFilter.type = 'lowshelf';
            effectFilter.frequency.setTargetAtTime(110, now, tc);
            effectFilter.gain.setTargetAtTime(9, now, tc);
            compressor.threshold.setTargetAtTime(-10, now, tc);
            compressor.ratio.setTargetAtTime(10, now, tc);
            compressor.attack.setTargetAtTime(0.005, now, tc);
            compressor.release.setTargetAtTime(0.15, now, tc);
            routeChain(effectFilter, compressor);
            break;

        case 'lofi':
            effectFilter.type = 'bandpass';
            effectFilter.frequency.setTargetAtTime(1200, now, tc);
            effectFilter.Q.setTargetAtTime(0.8, now, tc);
            routeChain(effectFilter);
            break;

        case 'library':
            effectFilter.type = 'lowpass';
            effectFilter.frequency.setTargetAtTime(1800, now, tc);
            effectFilter.Q.setTargetAtTime(0.5, now, tc);
            routeChain(effectFilter);
            break;

        case 'cinema':
            panner.pan.setTargetAtTime(0.15, now, tc);
            delay.delayTime.setTargetAtTime(0.045, now, tc);
            compressor.threshold.setTargetAtTime(-20, now, tc);
            compressor.ratio.setTargetAtTime(3.5, now, tc);
            eqOutput.connect(compressor);
            eqOutput.connect(delay);
            delay.connect(panner);
            panner.connect(compressor);
            compressor.connect(analyser);
            break;

        case 'none':
        default:
            routeChain();
            break;
    }
}

// ─── Apply Dimension Effect ────────────────────────────────────────────────
const dimensionLFOs = new Map();

export function applyDimensionEffect(ctx, dimensionId, nodes) {
    if (!nodes || !nodes.eqOutput) return;

    const { eqOutput, analyser, panner, reverbNode, convolver, effectGain } = nodes;
    const dimension = DIMENSIONS.find(d => d.id === dimensionId) || DIMENSIONS[0];

    // Safety fallback
    const revNode = reverbNode || convolver;
    if (!revNode || !effectGain) {
        console.warn('[effectUtils] Missing required nodes for dimension effect');
        return;
    }

    const now = ctx.currentTime;
    const tc = 0.05; // Quick parameter transitions
    const fadeTime = 0.15; // Smooth crossfade time for switching dimensions

    // 1. Fade OUT existing wet signal quickly to prevent pops
    effectGain.gain.exponentialRampToValueAtTime(0.001, now + fadeTime);

    // 2. Setup Panning (LFO) with smooth frequency transitions
    let existingLFO = dimensionLFOs.get(ctx);
    
    if (dimension.panning.startsWith('lfo')) {
        let frequency = 0.1;
        if (dimension.panning === 'lfo-med') frequency = 0.25;
        if (dimension.panning === 'lfo-fast') frequency = 0.5;
        if (dimension.panning === 'lfo-dynamic') frequency = 0.8;

        if (!existingLFO) {
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.setValueAtTime(frequency, now);
            lfoGain.gain.setValueAtTime(0.8, now);
            lfo.connect(lfoGain);
            lfoGain.connect(panner.pan);
            lfo.start();
            dimensionLFOs.set(ctx, { osc: lfo, gain: lfoGain });
            existingLFO = { osc: lfo, gain: lfoGain };
        } else {
            // Smoothly slide the LFO frequency to the new value
            existingLFO.osc.frequency.setTargetAtTime(frequency, now, 0.2);
        }
    } else {
        // No LFO, smooth back to center
        if (existingLFO) {
            existingLFO.osc.stop(now + 0.5);
            dimensionLFOs.delete(ctx);
        }
        panner.pan.setTargetAtTime(0, now, 0.2);
    }

    // 3. Setup Reverb (Simulating dimensions via "space")
    // Delay the buffer swap slightly until we are faded out
    setTimeout(() => {
        const switchNow = ctx.currentTime;
        
        try {
            // Disconnect old routes only if necessary, but better to keep graph stable
            // In this architecture, we keep eqOutput -> panner -> analyser (dry)
            // and eqOutput -> revNode -> effectGain -> panner (wet)
            
            // Re-establish stable connections if they were broken by previous logic
            eqOutput.disconnect();
            panner.disconnect();
            revNode.disconnect();
            effectGain.disconnect();

            // Dry Path
            eqOutput.connect(panner);
            panner.connect(analyser);

            if (dimension.reverb > 0) {
                // Buffer swap is safe while effectGain is 0
                revNode.buffer = getImpulseResponse(ctx, dimension.reverb > 0.5 ? 'stadium' : 'hall');
                
                // Wet Path
                eqOutput.connect(revNode);
                revNode.connect(effectGain);
                effectGain.connect(panner);

                // Fade IN the new reverb
                effectGain.gain.setTargetAtTime(dimension.reverb * 0.6, switchNow, tc);
            } else {
                effectGain.gain.setTargetAtTime(0, switchNow, tc);
            }
        } catch (e) {
            console.warn('[effectUtils] Dimension re-route error', e);
        }
    }, fadeTime * 1000);
}
