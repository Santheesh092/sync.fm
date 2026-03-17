// src/lib/djEngine.js
// DJ Web Audio API Engine

export class DJEngine {
    constructor(audioContext) {
        this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        // Master Output Chain
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        
        this.masterAnalyser = this.ctx.createAnalyser();
        this.masterAnalyser.fftSize = 2048;

        // Recording Destination
        this.recordingDest = this.ctx.createMediaStreamDestination();
        this.recorder = null;
        this.recordedChunks = [];
        this.isRecording = false;
        this.isPaused = false;
        this.recordingStartTime = 0;
        this.pausedTime = 0;
        
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.connect(this.ctx.destination);
        this.masterAnalyser.connect(this.recordingDest);

        // Crossfader: 0.0 (full A) to 1.0 (full B), 0.5 = center
        this.crossfaderValue = 0.5;
        this.crossfaderCurve = 'smooth'; // 'linear' | 'smooth' | 'sharp'

        // Decks
        this.decks = {
            A: this.createDeckChain('A'),
            B: this.createDeckChain('B')
        };
        
        // ✅ FIX: Connect crossGain → masterGain (was incorrectly wiring faderGain → masterGain)
        // Signal chain: trim → eq → fader → crossGain → masterGain
        this.decks.A.crossGain.connect(this.masterGain);
        this.decks.B.crossGain.connect(this.masterGain);
        
        this.updateCrossfader();
        
        // Beat Sync Engine
        this.sync = new BeatSyncEngine();
    }
    
    createDeckChain(deckId) {
        const ctx = this.ctx;
        // Gain → EQ Hi → EQ Mid → EQ Low → Filter → FX Chain → Channel Fader → Crossfader Gain
        const trim = ctx.createGain();
        trim.gain.value = 1.0;
        
        const eqHi = ctx.createBiquadFilter();
        eqHi.type = 'highshelf';
        eqHi.frequency.value = 3200;
        
        const eqMid = ctx.createBiquadFilter();
        eqMid.type = 'peaking';
        eqMid.frequency.value = 1000;
        eqMid.Q.value = 0.5;
        
        const eqLow = ctx.createBiquadFilter();
        eqLow.type = 'lowshelf';
        eqLow.frequency.value = 300;
        
        const fxFilter = ctx.createBiquadFilter();
        fxFilter.type = 'peaking';
        fxFilter.gain.value = 0;

        // --- FX Unit Chain ---
        
        // 1. Flanger
        const flangerDelay = ctx.createDelay();
        flangerDelay.delayTime.value = 0.003;
        const flangerFeedback = ctx.createGain();
        flangerFeedback.gain.value = 0;
        const flangerLFO = ctx.createOscillator();
        const flangerLFOGain = ctx.createGain();
        flangerLFOGain.gain.value = 0.002;
        flangerLFO.frequency.value = 0.25;
        flangerLFO.connect(flangerLFOGain);
        flangerLFOGain.connect(flangerDelay.delayTime);
        flangerLFO.start();
        
        const flangerWet = ctx.createGain();
        flangerWet.gain.value = 0;
        const flangerDry = ctx.createGain();
        flangerDry.gain.value = 1;

        // 2. Phaser
        const phaserStages = [];
        for (let i = 0; i < 8; i++) {
            const stage = ctx.createBiquadFilter();
            stage.type = 'allpass';
            stage.frequency.value = 1000;
            phaserStages.push(stage);
        }
        const phaserLFO = ctx.createOscillator();
        const phaserLFOGain = ctx.createGain();
        phaserLFOGain.gain.value = 500;
        phaserLFO.frequency.value = 0.5;
        phaserLFO.connect(phaserLFOGain);
        phaserLFO.start();
        
        const phaserWet = ctx.createGain();
        phaserWet.gain.value = 0;
        const phaserDry = ctx.createGain();
        phaserDry.gain.value = 1;

        // 3. Echo
        const echoDelay = ctx.createDelay(5.0);
        echoDelay.delayTime.value = 0.5;
        const echoFeedback = ctx.createGain();
        echoFeedback.gain.value = 0.4;
        const echoWet = ctx.createGain();
        echoWet.gain.value = 0;
        const echoDry = ctx.createGain();
        echoDry.gain.value = 1;

        // 4. Reverb
        const reverbConvolver = ctx.createConvolver();
        const reverbWet = ctx.createGain();
        reverbWet.gain.value = 0;
        const reverbDry = ctx.createGain();
        reverbDry.gain.value = 1;
        
        const faderGain = ctx.createGain();
        faderGain.gain.value = 1.0;

        const crossGain = ctx.createGain();
        crossGain.gain.value = 1.0;
        
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        
        // Full signal routing
        trim.connect(eqHi);
        eqHi.connect(eqMid);
        eqMid.connect(eqLow);
        eqLow.connect(fxFilter);
        
        // Route through FX Chain
        const FXInput = fxFilter;
        
        // Flanger Routing
        FXInput.connect(flangerDry);
        FXInput.connect(flangerDelay);
        flangerDelay.connect(flangerFeedback);
        flangerFeedback.connect(flangerDelay);
        flangerDelay.connect(flangerWet);
        
        const flangerOut = ctx.createGain();
        flangerDry.connect(flangerOut);
        flangerWet.connect(flangerOut);

        // Phaser Routing
        flangerOut.connect(phaserDry);
        let phaserLastStage = flangerOut;
        phaserStages.forEach(stage => {
            phaserLastStage.connect(stage);
            phaserLFOGain.connect(stage.frequency);
            phaserLastStage = stage;
        });
        phaserLastStage.connect(phaserWet);
        
        const phaserOut = ctx.createGain();
        phaserDry.connect(phaserOut);
        phaserWet.connect(phaserOut);

        // Echo Routing
        phaserOut.connect(echoDry);
        phaserOut.connect(echoDelay);
        echoDelay.connect(echoFeedback);
        echoFeedback.connect(echoDelay);
        echoDelay.connect(echoWet);
        
        const echoOut = ctx.createGain();
        echoDry.connect(echoOut);
        echoWet.connect(echoOut);

        // Reverb Routing
        echoOut.connect(reverbDry);
        echoOut.connect(reverbConvolver);
        reverbConvolver.connect(reverbWet);
        
        const reverbOut = ctx.createGain();
        reverbDry.connect(reverbOut);
        reverbWet.connect(reverbOut);

        // Connect to Fader
        reverbOut.connect(faderGain);
        faderGain.connect(crossGain);
        
        // Tap for VU meter (Post-Fader for visual feedback)
        faderGain.connect(analyser);
        
        return {
            source: null,
            trim,
            eqHi,
            eqMid,
            eqLow,
            fxFilter,
            fx: {
                flanger: { delay: flangerDelay, feedback: flangerFeedback, lfo: flangerLFO, lfoGain: flangerLFOGain, wet: flangerWet, dry: flangerDry },
                phaser: { stages: phaserStages, lfo: phaserLFO, lfoGain: phaserLFOGain, wet: phaserWet, dry: phaserDry },
                echo: { delay: echoDelay, feedback: echoFeedback, wet: echoWet, dry: echoDry, syncEnabled: false },
                reverb: { convolver: reverbConvolver, wet: reverbWet, dry: reverbDry }
            },
            faderGain,
            crossGain,
            analyser,
            currentBuffer: null,
            isPlaying: false,
            startTime: 0,
            pausedAt: 0,
            playbackRate: 1.0,
            detune: 0,
            hotcues: Array(8).fill(null),
            bpm: 128.0
        };
    }

    // --- Recording Methods ---

    startRecording(quality = 'High') {
        if (this.isRecording) return;
        
        this.recordedChunks = [];
        const mimeType = quality === 'Lossless WAV' ? 'audio/webm;codecs=pcm' : 'audio/webm;codecs=opus';
        const bitsPerSecond = quality === 'High' ? 256000 : 128000;

        try {
            this.recorder = new MediaRecorder(this.recordingDest.stream, {
                mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'audio/webm',
                audioBitsPerSecond: bitsPerSecond
            });

            this.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.recordedChunks.push(e.data);
            };

            this.recorder.start(100);
            this.isRecording = true;
            this.isPaused = false;
            this.recordingStartTime = this.ctx.currentTime;
            console.log('[DJEngine] Recording started');
        } catch (err) {
            console.error('[DJEngine] Failed to start recorder:', err);
        }
    }

    pauseRecording() {
        if (!this.isRecording || this.isPaused) return;
        this.recorder.pause();
        this.isPaused = true;
        this.pausedTime = this.ctx.currentTime;
        console.log('[DJEngine] Recording paused');
    }

    resumeRecording() {
        if (!this.isRecording || !this.isPaused) return;
        this.recorder.resume();
        this.isPaused = false;
        console.log('[DJEngine] Recording resumed');
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.isRecording) return resolve(null);
            
            this.recorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: this.recorder.mimeType });
                this.isRecording = false;
                this.isPaused = false;
                console.log('[DJEngine] Recording stopped');
                resolve(blob);
            };
            this.recorder.stop();
        });
    }

    getRecordingTime() {
        if (!this.isRecording) return 0;
        const total = this.isPaused ? this.pausedTime : this.ctx.currentTime;
        return total - this.recordingStartTime;
    }

    // --- FX Control Methods ---

    setFXParam(deckId, fxType, param, value) {
        const deck = this.decks[deckId];
        if (!deck) return;
        const fx = deck.fx[fxType];
        if (!fx) return;

        const now = this.ctx.currentTime;

        switch (fxType) {
            case 'flanger':
                if (param === 'rate') fx.lfo.frequency.setTargetAtTime(value, now, 0.1);
                if (param === 'depth') fx.lfoGain.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'feedback') fx.feedback.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'mix') {
                    fx.wet.gain.setTargetAtTime(value, now, 0.05);
                    fx.dry.gain.setTargetAtTime(1 - value, now, 0.05);
                }
                break;
            case 'phaser':
                if (param === 'rate') fx.lfo.frequency.setTargetAtTime(value, now, 0.1);
                if (param === 'resonance') {
                    fx.lfoGain.gain.setTargetAtTime(value * 1000, now, 0.1);
                }
                if (param === 'mix') {
                    fx.wet.gain.setTargetAtTime(value, now, 0.05);
                    fx.dry.gain.setTargetAtTime(1 - value, now, 0.05);
                }
                break;
            case 'echo':
                if (param === 'time') fx.delay.delayTime.setTargetAtTime(value, now, 0.1);
                if (param === 'feedback') fx.feedback.gain.setTargetAtTime(value, now, 0.1);
                if (param === 'mix') {
                    fx.wet.gain.setTargetAtTime(value, now, 0.05);
                    fx.dry.gain.setTargetAtTime(1 - value, now, 0.05);
                }
                if (param === 'sync') fx.syncEnabled = value;
                break;
            case 'reverb':
                if (param === 'mix') {
                    fx.wet.gain.setTargetAtTime(value, now, 0.05);
                    fx.dry.gain.setTargetAtTime(1 - value, now, 0.05);
                }
                if (param === 'type') {
                    this.loadReverbIR(deckId, value);
                }
                break;
        }
    }

    async loadReverbIR(deckId, type) {
        const deck = this.decks[deckId];
        const ctx = this.ctx;
        const rate = ctx.sampleRate;
        let length, decay;

        switch (type) {
            case 'Room': length = rate * 0.8; decay = 6.0; break;
            case 'Hall': length = rate * 3.0; decay = 1.8; break;
            case 'Cathedral': length = rate * 6.0; decay = 1.2; break;
            case 'Plate': length = rate * 1.5; decay = 4.5; break;
            case 'Spring': length = rate * 2.0; decay = 3.0; break;
            default: length = rate * 1.0; decay = 5.0;
        }

        const impulse = ctx.createBuffer(2, length, rate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length;
            const amp = Math.pow(1 - n, decay);
            left[i] = (Math.random() * 2 - 1) * amp;
            right[i] = (Math.random() * 2 - 1) * amp;
        }
        deck.fx.reverb.convolver.buffer = impulse;
    }

    /**
     * Set crossfader position.
     * @param {number} val - 0.0 (full Deck A) to 1.0 (full Deck B), 0.5 = both equal
     * @param {string|null} curve - 'linear' | 'smooth' | 'sharp' (optional)
     */
    setCrossfader(val, curve = null) {
        this.crossfaderValue = Math.max(0, Math.min(1, val));
        if (curve) this.crossfaderCurve = curve;
        this.updateCrossfader();
    }

    updateCrossfader() {
        const pos = this.crossfaderValue; // 0 = full A, 1 = full B
        let gainA = 1.0;
        let gainB = 1.0;

        if (this.crossfaderCurve === 'smooth') {
            // Constant-power (equal-power) crossfade — professional DJ standard
            // Both sides are at ~70.7% at center (cos 45°). No audible dip, seamless blend.
            gainA = Math.cos(pos * 0.5 * Math.PI);
            gainB = Math.cos((1.0 - pos) * 0.5 * Math.PI);

        } else if (this.crossfaderCurve === 'linear') {
            // True linear crossfade — creates a clear volume dip at center (both at 50%).
            // Noticeably different from smooth: center sounds quieter, transitions feel "slower".
            gainA = 1.0 - pos;
            gainB = pos;

        } else if (this.crossfaderCurve === 'sharp') {
            // Battle / hard-cut mode: each deck stays at FULL volume until the fader
            // crosses the center (0.5). At center both play fully; past center, A cuts.
            // This gives an immediate hard switch — perfect for scratching & juggling.
            if (pos <= 0.5) {
                gainA = 1.0;                          // A stays full until center
                gainB = pos / 0.5;                    // B ramps up from 0 → 1 as fader goes 0 → 0.5
            } else {
                gainA = (1.0 - pos) / 0.5;            // A ramps down from 1 → 0 as fader goes 0.5 → 1
                gainB = 1.0;                          // B stays full from center onward
            }
        }

        const now = this.ctx.currentTime;
        // Use a very short ramp (3ms) for smooth → sharp transitions; near-instant for sharp battles
        const ramp = this.crossfaderCurve === 'sharp' ? 0.002 : 0.008;
        this.decks.A.crossGain.gain.setTargetAtTime(gainA, now, ramp);
        this.decks.B.crossGain.gain.setTargetAtTime(gainB, now, ramp);
    }
    
    setEQ(deckId, band, valueDb) {
        const deck = this.decks[deckId];
        if (!deck) return;
        
        if (band === 'hi') deck.eqHi.gain.setTargetAtTime(valueDb, this.ctx.currentTime, 0.01);
        else if (band === 'mid') deck.eqMid.gain.setTargetAtTime(valueDb, this.ctx.currentTime, 0.01);
        else if (band === 'low') deck.eqLow.gain.setTargetAtTime(valueDb, this.ctx.currentTime, 0.01);
        else if (band === 'gain') {
            const linearGain = valueDb < -55 ? 0 : Math.pow(10, valueDb / 20);
            deck.trim.gain.setTargetAtTime(linearGain, this.ctx.currentTime, 0.01);
        }
    }

    setHotCue(deckId, index) {
        const deck = this.decks[deckId];
        if (!deck) return;
        const currentTime = this.getCurrentTime(deckId);
        deck.hotcues[index] = currentTime;
        return currentTime;
    }

    jumpToHotCue(deckId, index) {
        const deck = this.decks[deckId];
        if (!deck || deck.hotcues[index] === null) return;
        this.seek(deckId, deck.hotcues[index]);
    }

    clearHotCue(deckId, index) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.hotcues[index] = null;
    }

    async loadTrack(deckId, arrayBuffer) {
        const buffer = await this.ctx.decodeAudioData(arrayBuffer);
        const deck = this.decks[deckId];
        deck.currentBuffer = buffer;
        deck.pausedAt = 0;
        deck.hotcues = Array(8).fill(null); // Reset cue points on new track
        
        // BPM placeholder — real detection would be a separate worker
        deck.bpm = 120.0 + Math.floor(Math.random() * 16);
        
        return buffer;
    }

    play(deckId) {
        const deck = this.decks[deckId];
        if (!deck || !deck.currentBuffer) return;
        if (deck.isPlaying) return;
        
        deck.source = this.ctx.createBufferSource();
        deck.source.buffer = deck.currentBuffer;
        deck.source.playbackRate.value = deck.playbackRate;
        deck.source.detune.value = deck.detune * 100; // cents
        
        deck.source.connect(deck.trim);
        
        deck.source.start(0, deck.pausedAt);
        deck.startTime = this.ctx.currentTime - (deck.pausedAt / deck.playbackRate);
        deck.isPlaying = true;
    }

    pause(deckId) {
        const deck = this.decks[deckId];
        if (!deck || !deck.isPlaying || !deck.source) return;
        
        deck.source.stop();
        deck.pausedAt = (this.ctx.currentTime - deck.startTime) * deck.playbackRate;
        deck.isPlaying = false;
        deck.source.disconnect();
        deck.source = null;
    }

    stop(deckId) {
        this.pause(deckId);
        this.decks[deckId].pausedAt = 0;
    }
    
    seek(deckId, timeSeconds) {
        const deck = this.decks[deckId];
        if (!deck) return;
        
        const wasPlaying = deck.isPlaying;
        if (wasPlaying) this.pause(deckId);
        
        deck.pausedAt = Math.max(0, timeSeconds);
        
        if (wasPlaying) this.play(deckId);
    }
    
    getCurrentTime(deckId) {
        const deck = this.decks[deckId];
        if (!deck || !deck.currentBuffer) return 0;
        if (deck.isPlaying) {
            const time = (this.ctx.currentTime - deck.startTime) * deck.playbackRate;
            if (time >= deck.currentBuffer.duration) {
                this.pause(deckId);
                deck.pausedAt = 0;
                return 0;
            }
            return time;
        }
        return deck.pausedAt;
    }

    getDuration(deckId) {
        const deck = this.decks[deckId];
        return deck?.currentBuffer?.duration || 0;
    }

    // Relative movement for jog wheel
    jog(deckId, deltaSeconds) {
        const deck = this.decks[deckId];
        if (!deck || !deck.currentBuffer) return;
        
        const newPos = Math.max(0, Math.min(deck.currentBuffer.duration, this.getCurrentTime(deckId) + deltaSeconds));
        this.seek(deckId, newPos);
    }
    
    setTempo(deckId, rate) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.playbackRate = rate;
        if (deck.source) {
            const currentPos = (this.ctx.currentTime - deck.startTime) * deck.playbackRate;
            deck.source.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.05);
            deck.startTime = this.ctx.currentTime - (currentPos / rate);
        }
    }
    
    setPitch(deckId, semitones) {
        const deck = this.decks[deckId];
        if (!deck) return;
        deck.detune = semitones;
        if (deck.source) {
            deck.source.detune.setTargetAtTime(semitones * 100, this.ctx.currentTime, 0.05);
        }
    }
}

export class BeatSyncEngine {
    constructor() {
        this.masterBPM = 120.0;
        this.tapTempos = [];
    }
    
    syncDeck(deckData, engineDeckState, engineObj, deckId) {
        const ratio = this.masterBPM / engineDeckState.bpm;
        engineObj.setTempo(deckId, ratio);
        return ratio;
    }
    
    tap() {
        const now = performance.now();
        this.tapTempos.push(now);
        if (this.tapTempos.length > 8) this.tapTempos.shift();
        
        if (this.tapTempos.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.tapTempos.length; i++) {
                intervals.push(this.tapTempos[i] - this.tapTempos[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            
            if (avgInterval > 200 && avgInterval < 1500) {
                this.masterBPM = Math.round((60000 / avgInterval) * 10) / 10;
            }
        }
        return this.masterBPM;
    }
}
