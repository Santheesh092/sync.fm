// src/lib/djSamples.js
// Handles fetching, decoding, and playing one-shot AudioBuffer samples for the 64-pad (4 banks × 16) Sound FX grid.

export const SAMPLE_BANKS = [
    {
        id: 'A',
        name: 'Classic FX',
        samples: [
            { id: 'horn', label: 'Airhorn', synthFreq: 880, synthType: 'square' },
            { id: 'drum', label: 'Kick Drop', synthFreq: 60, synthType: 'sine' },
            { id: 'scratch', label: 'Scratch', synthFreq: 440, synthType: 'sawtooth' },
            { id: 'bass', label: 'Sub Bass', synthFreq: 40, synthType: 'sine' },
            { id: 'echo', label: 'Verb Hit', synthFreq: 660, synthType: 'square' },
            { id: 'sweep', label: 'Riser', synthFreq: 220, synthType: 'sine' },
            { id: 'siren', label: 'Siren', synthFreq: 1100, synthType: 'triangle' },
            { id: 'cymbal', label: 'Cymbal', synthFreq: 0, synthType: 'noise' },
            { id: 'rewind', label: 'Rewind', synthFreq: 800, synthType: 'sawtooth' },
            { id: 'crowd', label: 'Crowd Wash', synthFreq: 0, synthType: 'noise' },
            { id: 'laser', label: 'Laser Zap', synthFreq: 2000, synthType: 'sawtooth' },
            { id: 'vinyl', label: 'Vinyl Stop', synthFreq: 100, synthType: 'sine' },
            { id: 'alarm', label: 'Alert', synthFreq: 900, synthType: 'square' },
            { id: 'foghorn', label: 'Foghorn', synthFreq: 120, synthType: 'square' },
            { id: 'clap', label: 'Hand Clap', synthFreq: 0, synthType: 'noise' },
            { id: 'snare', label: 'Power Snare', synthFreq: 0, synthType: 'noise' }
        ]
    },
    {
        id: 'B',
        name: 'Space & Tech',
        samples: [
            { id: 'pulse', label: 'Deep Pulse', synthFreq: 50, synthType: 'sine' },
            { id: 'glitch', label: 'Glitch Bit', synthFreq: 4000, synthType: 'square' },
            { id: 'orbit', label: 'Orbit Sweep', synthFreq: 300, synthType: 'sine' },
            { id: 'warp', label: 'Warp Drive', synthFreq: 80, synthType: 'sawtooth' },
            { id: 'shimmer', label: 'Shimmer', synthFreq: 3000, synthType: 'triangle' },
            { id: 'impact', label: 'Deep Impact', synthFreq: 35, synthType: 'sine' },
            { id: 'spark', label: 'Electric', synthFreq: 5000, synthType: 'noise' },
            { id: 'drone', label: 'Space Drone', synthFreq: 120, synthType: 'sawtooth' },
            { id: 'alien', label: 'Alien Talk', synthFreq: 440, synthType: 'triangle' },
            { id: 'beam', label: 'Beam Up', synthFreq: 1500, synthType: 'sine' },
            { id: 'crush', label: 'Bit Crush', synthFreq: 200, synthType: 'sawtooth' },
            { id: 'echo2', label: 'Sky Echo', synthFreq: 1200, synthType: 'square' },
            { id: 'noise2', label: 'White Out', synthFreq: 0, synthType: 'noise' },
            { id: 'ping', label: 'Sonar', synthFreq: 2500, synthType: 'sine' },
            { id: 'rev_kick', label: 'Reverse', synthFreq: 100, synthType: 'sine' },
            { id: 'wobble', label: 'Wobble', synthFreq: 60, synthType: 'sawtooth' }
        ]
    }
];

const synthBuffers = new Map();

/**
 * Creates a synthetic drum/fx buffer using OfflineAudioContext.
 * Improved for punchier transients and richer textures.
 */
async function generateSynthBuffer(ctx, sampleCfg) {
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, ctx.sampleRate * 2, ctx.sampleRate);
    
    // Create base oscillator or noise
    let source;
    let filter = offlineCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;

    if (sampleCfg.synthType === 'noise') {
        const bufferSize = offlineCtx.sampleRate * 2;
        const buffer = offlineCtx.createBuffer(1, bufferSize, offlineCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        source = offlineCtx.createBufferSource();
        source.buffer = buffer;

        // Custom filter for noise
        if (sampleCfg.id === 'cymbal' || sampleCfg.id === 'spark') {
            filter.type = 'highpass';
            filter.frequency.value = 8000;
        } else if (sampleCfg.id === 'clap' || sampleCfg.id === 'snare') {
            filter.type = 'bandpass';
            filter.frequency.value = 1200;
            filter.Q.value = 1.5;
        }
    } else {
        source = offlineCtx.createOscillator();
        source.type = sampleCfg.synthType;
        source.frequency.value = sampleCfg.synthFreq;
        
        // Characteristic pitch sweeps
        if (sampleCfg.id === 'horn') {
            source.frequency.setValueAtTime(880, 0);
            source.frequency.exponentialRampToValueAtTime(110, 0.5);
        } else if (['drum', 'impact', 'bass'].includes(sampleCfg.id)) {
            source.frequency.setValueAtTime(150, 0);
            source.frequency.exponentialRampToValueAtTime(sampleCfg.synthFreq, 0.4);
            // Punchier transient for drums
            if (sampleCfg.id === 'drum' || sampleCfg.id === 'impact') {
                source.frequency.setValueAtTime(400, 0);
                source.frequency.exponentialRampToValueAtTime(sampleCfg.synthFreq, 0.05);
            }
        } else if (sampleCfg.id === 'laser' || sampleCfg.id === 'glitch') {
            source.frequency.setValueAtTime(sampleCfg.id === 'glitch' ? 8000 : 2000, 0);
            source.frequency.exponentialRampToValueAtTime(100, sampleCfg.id === 'glitch' ? 0.05 : 0.2);
        } else if (sampleCfg.id === 'siren' || sampleCfg.id === 'alien') {
            const freq = sampleCfg.synthFreq;
            source.frequency.setValueAtTime(freq, 0);
            for (let i = 1; i < 5; i++) {
                source.frequency.linearRampToValueAtTime(freq * 1.5, i * 0.4 - 0.2);
                source.frequency.linearRampToValueAtTime(freq * 0.7, i * 0.4);
            }
        } else if (sampleCfg.id === 'sweep' || sampleCfg.id === 'orbit') {
            source.frequency.setValueAtTime(sampleCfg.id === 'orbit' ? 100 : 100, 0);
            source.frequency.exponentialRampToValueAtTime(sampleCfg.id === 'orbit' ? 2000 : 4000, 2.0);
        } else if (sampleCfg.id === 'ping') {
            source.frequency.setValueAtTime(2500, 0);
            source.frequency.exponentialRampToValueAtTime(2000, 0.8);
        } else if (sampleCfg.id === 'drone') {
            source.frequency.setValueAtTime(sampleCfg.synthFreq, 0);
            // Low-frequency oscillator effect
            for (let i = 0; i < 10; i++) {
                source.frequency.linearRampToValueAtTime(sampleCfg.synthFreq * 1.5, i * 0.2 + 0.1);
                source.frequency.linearRampToValueAtTime(sampleCfg.synthFreq * 0.8, i * 0.2 + 0.2);
            }
        } else if (sampleCfg.id === 'wobble') {
            source.frequency.setValueAtTime(sampleCfg.synthFreq, 0);
            for (let i = 0; i < 16; i++) {
                source.frequency.exponentialRampToValueAtTime(300, i * 0.125 + 0.0625);
                source.frequency.exponentialRampToValueAtTime(60, i * 0.125 + 0.125);
            }
        }
    }

    const gainNode = offlineCtx.createGain();
    
    // Amplitude envelopes for punch and clarity
    if (['drum', 'clap', 'snare', 'laser', 'glitch', 'impact'].includes(sampleCfg.id)) {
        gainNode.gain.setValueAtTime(1, 0);
        gainNode.gain.exponentialRampToValueAtTime(0.001, sampleCfg.id === 'glitch' ? 0.1 : 0.4);
    } else if (sampleCfg.id === 'bass' || sampleCfg.id === 'impact') {
        gainNode.gain.setValueAtTime(1, 0);
        gainNode.gain.exponentialRampToValueAtTime(0.001, 1.5);
    } else if (sampleCfg.id === 'sweep' || sampleCfg.id === 'orbit') {
        gainNode.gain.setValueAtTime(0.01, 0);
        gainNode.gain.linearRampToValueAtTime(0.8, 1.8);
        gainNode.gain.linearRampToValueAtTime(0.001, 2.0);
    } else if (sampleCfg.id === 'drone') {
        gainNode.gain.setValueAtTime(0.2, 0); // Start louder
        // Swell up
        gainNode.gain.linearRampToValueAtTime(0.9, 0.4);
        // Sustain
        gainNode.gain.linearRampToValueAtTime(0.7, 1.5);
        // Fade out
        gainNode.gain.linearRampToValueAtTime(0.001, 2.0);
    } else if (sampleCfg.id === 'horn') {
        gainNode.gain.setValueAtTime(1, 0);
        gainNode.gain.setValueAtTime(1, 0.1);
        gainNode.gain.setValueAtTime(0.2, 0.15);
        gainNode.gain.setValueAtTime(1, 0.2);
        gainNode.gain.setValueAtTime(1, 0.3);
        gainNode.gain.setValueAtTime(0.2, 0.35);
        gainNode.gain.setValueAtTime(1, 0.4);
        gainNode.gain.exponentialRampToValueAtTime(0.001, 1.5);
    } else {
        gainNode.gain.setValueAtTime(0.8, 0);
        gainNode.gain.exponentialRampToValueAtTime(0.001, 1.0); // Default fade
    }

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    source.start(0);
    
    return await offlineCtx.startRendering();
}

/**
 * Pre-computes all synthetic buffers to ensure instant playback without delay.
 * @param {AudioContext} ctx The main AudioContext
 */
export async function precalculateAllSamples(ctx) {
    if (!ctx) return;
    
    // Total samples to calculate
    const allSamples = SAMPLE_BANKS.flatMap(bank => bank.samples);
    
    // Only calculate missing ones to be efficient
    const promises = allSamples
        .filter(sampCfg => !synthBuffers.has(sampCfg.id))
        .map(async (sampCfg) => {
            try {
                const buf = await generateSynthBuffer(ctx, sampCfg);
                synthBuffers.set(sampCfg.id, buf);
            } catch (err) {
                console.error(`[djSamples] Failed to precalculate ${sampCfg.id}:`, err);
            }
        });
    
    if (promises.length > 0) {
        await Promise.all(promises);
        console.log(`[djSamples] Pre-calculated ${promises.length} new synth pads. Total: ${synthBuffers.size}`);
    }
}

/**
 * Triggers a specific pad sample.
 * @param {AudioContext} ctx 
 * @param {AudioNode} destination 
 * @param {string} sampleId 
 */
export function playSample(ctx, destination, sampleId) {
    const buffer = synthBuffers.get(sampleId);
    if (!buffer) return null;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = ctx.createGain();
    gain.gain.value = 0.8; // Pad volume mix

    source.connect(gain);
    gain.connect(destination);
    
    source.start(0);
    
    // Return node info so caller can potentially stop it early if it's a loop
    return { source, gain };
}
