import { useState, useEffect, useRef, useCallback } from 'react';
import DJDeck from './dj/DJDeck';
import DJMixer from './dj/DJMixer';
import DJPads from './dj/DJPads';
import { 
    Mic, Square, Play, Pause, Save, Share2, 
    Download, Trash2, Clock, Activity, AlertCircle,
    CheckCircle2, X, Layers
} from 'lucide-react';
import { DJEngine } from '../lib/djEngine';
import { precalculateAllSamples } from '../lib/djSamples';

export default function DJConsole({ audioContext, roomName }) {
    const engineRef = useRef(null);
    const [isReady, setIsReady] = useState(false);
    // Mobile tab state: 'A' | 'mixer' | 'B'
    const [mobileTab, setMobileTab] = useState('A');
    const [showPads, setShowPads] = useState(false);
    const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

    useEffect(() => {
        const handleResize = () => {
            setIsPortrait(window.innerHeight > window.innerWidth);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Global Mixer State — crossfader 0.5 = center
    const [mixerState, setMixerState] = useState({
        crossfader: 0.5,
        curve: 'smooth',
        deckA: { fader: 0.8, vu: 0, eq: { hi: 0, mid: 0, low: 0, gain: 0 } },
        deckB: { fader: 0.8, vu: 0, eq: { hi: 0, mid: 0, low: 0, gain: 0 } },
    });
    const mixerStateRef = useRef(mixerState);
    useEffect(() => { mixerStateRef.current = mixerState; }, [mixerState]);

    // Deck States
    const defaultDeck = {
        isPlaying: false,
        trackName: 'Load Track',
        bpm: 128.0,
        tempo: 1.0,
        pitch: 0,
        currentTime: 0,
        duration: 0,
        cue: false,
        sync: false,
        hotcues: Array(8).fill(null)
    };

    const [deckA, setDeckA] = useState({ ...defaultDeck });
    const [deckB, setDeckB] = useState({ ...defaultDeck });

    // Recording State
    const [recordingState, setRecordingState] = useState({
        isRecording: false,
        isPaused: false,
        time: 0,
        quality: 'High',
        projectName: 'My Live Mix',
        blob: null
    });
    const [showRecordingPanel, setShowRecordingPanel] = useState(false);
    const [recordingHistory, setRecordingHistory] = useState([]);

    // Deck Expansion States (for dynamic heights)
    const [deckAExpanded, setDeckAExpanded] = useState(false);
    const [deckBExpanded, setDeckBExpanded] = useState(false);

    const toggleDeckAExpand = useCallback((val) => setDeckAExpanded(val), []);
    const toggleDeckBExpand = useCallback((val) => setDeckBExpanded(val), []);

    // Initialize DJ Engine helper
    const initEngine = useCallback(async (providedCtx) => {
        if (engineRef.current) return engineRef.current;
        
        const ctx = providedCtx || audioContext || new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
            await ctx.resume();
        }

        const engine = new DJEngine(ctx);
        const initialMixer = mixerStateRef.current;
        
        // Sync initial state from React to Audio Engine
        engine.setCrossfader(initialMixer.crossfader, initialMixer.curve);
        engine.decks.A.faderGain.gain.value = initialMixer.deckA.fader;
        engine.decks.B.faderGain.gain.value = initialMixer.deckB.fader;
        
        // Apply initial EQs
        ['hi', 'mid', 'low', 'gain'].forEach(band => {
            engine.setEQ('A', band, initialMixer.deckA.eq[band]);
            engine.setEQ('B', band, initialMixer.deckB.eq[band]);
        });

        engineRef.current = engine;
        setIsReady(true);
        
        // Background pre-calculation of samples
        precalculateAllSamples(ctx).then(() => {
            console.log('[DJConsole] Background samples ready');
        });

        return engine;
    }, [audioContext]);

    // Initialize DJ Engine automatically if AudioContext exists
    useEffect(() => {
        if (audioContext && !engineRef.current) {
            initEngine(audioContext);
        }
    }, [audioContext, initEngine]);

    // Dedicated cleanup for unmounting
    useEffect(() => {
        return () => {
            if (engineRef.current) {
                engineRef.current.stop('A');
                engineRef.current.stop('B');
            }
        };
    }, []);

    // VU Meter + Playhead Animation Loop
    useEffect(() => {
        if (!isReady || !engineRef.current) return;
        
        const eng = engineRef.current;
        const dataA = new Uint8Array(eng.decks.A.analyser.frequencyBinCount);
        const dataB = new Uint8Array(eng.decks.B.analyser.frequencyBinCount);
        
        let reqId;
        const tick = () => {
            eng.decks.A.analyser.getByteTimeDomainData(dataA);
            eng.decks.B.analyser.getByteTimeDomainData(dataB);
            
            const calcVU = (data) => {
                let sum = 0;
                for (let i = 0; i < data.length; i++) {
                    const norm = (data[i] / 128.0) - 1.0;
                    sum += norm * norm;
                }
                return Math.min(1.0, Math.sqrt(sum / data.length) * 4);
            };
            
            setMixerState(prev => ({
                ...prev,
                deckA: { ...prev.deckA, vu: calcVU(dataA) },
                deckB: { ...prev.deckB, vu: calcVU(dataB) }
            }));
            
            setDeckA(prev => ({ 
                ...prev, 
                currentTime: eng.getCurrentTime('A'),
                duration: eng.getDuration('A'),
                isPlaying: eng.decks.A.isPlaying
            }));
            setDeckB(prev => ({ 
                ...prev, 
                currentTime: eng.getCurrentTime('B'),
                duration: eng.getDuration('B'),
                isPlaying: eng.decks.B.isPlaying
            }));

            // Update Recording Time
            if (eng.isRecording && !eng.isPaused) {
                setRecordingState(prev => ({ ...prev, time: eng.getRecordingTime() }));
            }
            
            reqId = requestAnimationFrame(tick);
        };
        reqId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(reqId);
    }, [isReady]);

    // ✅ FIX: Pass extra (3rd arg) so hot cue action 'set'/'jump'/'clear' reaches the handler
    const handleDeckControl = useCallback((deckId, control, value, extra) => {
        const eng = engineRef.current;
        if (!eng || !isReady) return;

        const setter = deckId === 'A' ? setDeckA : setDeckB;

        if (control === 'play') {
            if (value) eng.play(deckId);
            else eng.pause(deckId);
            setter(prev => ({ ...prev, isPlaying: value }));
        }
        else if (control === 'cue') {
            setter(prev => ({ ...prev, cue: value }));
        }
        else if (control === 'tempo') {
            eng.setTempo(deckId, value);
            setter(prev => ({ ...prev, tempo: value }));
        }
        else if (control === 'pitch') {
            eng.setPitch(deckId, value);
            setter(prev => ({ ...prev, pitch: value }));
        }
        else if (control === 'hotcue') {
            // value = pad index (0-3), extra = 'set' | 'jump' | 'clear'
            if (extra === 'set') {
                const time = eng.setHotCue(deckId, value);
                setter(prev => {
                    const newCues = [...prev.hotcues];
                    newCues[value] = time;
                    return { ...prev, hotcues: newCues };
                });
            } else if (extra === 'jump') {
                eng.jumpToHotCue(deckId, value);
            } else if (extra === 'clear') {
                eng.clearHotCue(deckId, value);
                setter(prev => {
                    const newCues = [...prev.hotcues];
                    newCues[value] = null;
                    return { ...prev, hotcues: newCues };
                });
            }
        }
        else if (control === 'sync') {
            setter(prev => {
                const newSync = !prev.sync;
                if (newSync) {
                    const newRatio = eng.sync.syncDeck(prev, eng.decks[deckId], eng, deckId);
                    return { ...prev, sync: true, tempo: newRatio };
                } else {
                    return { ...prev, sync: false };
                }
            });
        }
        else if (control === 'jog') {
            eng.jog(deckId, value);
        }
        else if (control === 'seek') {
            eng.seek(deckId, value);
        }
        else if (control === 'fx') {
            // value = fxType, extra = { param, value }
            eng.setFXParam(deckId, value, extra.param, extra.value);
        }
        else if (control === 'loadStream') {
            handleStreamLoad(deckId, value);
        }
    }, [isReady]);

    const handleStreamLoad = async (deckId, url) => {
        if (!engineRef.current || !isReady) return;
        try {
            const resp = await fetch(url);
            const arrayBuf = await resp.arrayBuffer();
            await engineRef.current.loadTrack(deckId, arrayBuf);
            
            const setter = deckId === 'A' ? setDeckA : setDeckB;
            setter(prev => ({ 
                ...prev, 
                trackName: `Stream: ${new URL(url).hostname}`,
                isPlaying: false
            }));
        } catch (err) {
            console.error('[DJConsole] Failed to load stream:', err);
        }
    };

    // --- Recording Handlers ---

    const startRecording = () => {
        if (!engineRef.current) return;
        engineRef.current.startRecording(recordingState.quality);
        setRecordingState(prev => ({ ...prev, isRecording: true, isPaused: false, time: 0, blob: null }));
        setShowRecordingPanel(true);
    };

    const pauseRecording = () => {
        if (!engineRef.current) return;
        if (recordingState.isPaused) {
            engineRef.current.resumeRecording();
            setRecordingState(prev => ({ ...prev, isPaused: false }));
        } else {
            engineRef.current.pauseRecording();
            setRecordingState(prev => ({ ...prev, isPaused: true }));
        }
    };

    const stopRecording = async () => {
        if (!engineRef.current) return;
        const blob = await engineRef.current.stopRecording();
        setRecordingState(prev => ({ ...prev, isRecording: false, isPaused: false, blob }));
    };

    const saveRecording = () => {
        if (!recordingState.blob) return;
        const url = URL.createObjectURL(recordingState.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${recordingState.projectName}_${new Date().toISOString().slice(0,10)}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        
        setRecordingHistory(prev => [{
            name: recordingState.projectName,
            date: new Date().toLocaleDateString(),
            duration: formatRecordingTime(recordingState.time),
            blob: recordingState.blob
        }, ...prev]);
        
        setRecordingState(prev => ({ ...prev, blob: null }));
    };

    const formatRecordingTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    const handleMixerChange = useCallback((target, param, value) => {
        const eng = engineRef.current;
        if (!eng || !isReady) return;

        if (target === 'crossfader') {
            eng.setCrossfader(value); // value is 0–1
            setMixerState(prev => ({ ...prev, crossfader: value }));
        } 
        else if (target === 'curve') {
            // Update curve and re-apply crossfader with new curve
            eng.crossfaderCurve = value;
            eng.updateCrossfader();
            setMixerState(prev => ({ ...prev, curve: value }));
        }
        else if (target === 'A' || target === 'B') {
            if (param === 'fader') {
                eng.decks[target].faderGain.gain.setTargetAtTime(value, eng.ctx.currentTime, 0.05);
                setMixerState(prev => ({ ...prev, [`deck${target}`]: { ...prev[`deck${target}`], fader: value } }));
            } else if (param === 'eq') {
                eng.setEQ(target, value.band, value.val);
                setMixerState(prev => {
                    const nst = { ...prev };
                    nst[`deck${target}`] = { ...nst[`deck${target}`] };
                    nst[`deck${target}`].eq = { ...nst[`deck${target}`].eq, [value.band]: value.val };
                    return nst;
                });
            }
        }
    }, [isReady]);

    const handleFileLoad = async (deckId, file) => {
        let eng = engineRef.current;
        if (!eng) {
            eng = await initEngine();
        }
        if (!eng) return;

        const arrayBuf = await file.arrayBuffer();
        await eng.loadTrack(deckId, arrayBuf);
        
        const engineNode = eng.decks[deckId];
        const setter = deckId === 'A' ? setDeckA : setDeckB;

        setter(prev => ({ 
            ...prev, 
            trackName: file.name.replace(/\.[^.]+$/, ''),
            bpm: engineNode.bpm,
            currentTime: 0,
            isPlaying: false,
            hotcues: Array(8).fill(null) // Reset cues on new track load
        }));
    };

    // Loading screen removed for instant load experience

    return (
        <div className="flex flex-col h-full w-full p-4 text-[#E8F4FD] rounded-2xl overflow-hidden relative"
             style={{ 
                background: 'var(--brushed-metal)',
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.8)'
             }}>
            
            {/* Soft Ambient Volumetric Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none opacity-10" 
                 style={{ background: 'var(--neon-purple)' }} />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] pointer-events-none opacity-10" 
                 style={{ background: 'var(--neon-cyan)' }} />
            
            {/* Global Recording Indicator Bar */}
            {recordingState.isRecording && (
                <div className="bg-red-600/20 border-b border-red-500/30 px-4 py-1.5 flex items-center justify-between mb-2 rounded-t-lg overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent animate-pulse" />
                    <div className="flex items-center gap-3 z-10">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-500">RECORDING LIVE MIX</span>
                        <span className="text-xs font-mono font-black text-white ml-2">{formatRecordingTime(recordingState.time)}</span>
                    </div>
                    <div className="flex items-center gap-4 z-10">
                        <button onClick={pauseRecording} className="text-white/60 hover:text-white transition-colors">
                            {recordingState.isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
                        </button>
                        <button onClick={stopRecording} className="text-white/60 hover:text-white transition-colors">
                            <Square size={14} fill="currentColor" />
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`flex flex-wrap justify-between items-center gap-3 mb-3 bg-white/5 px-4 py-2.5 rounded-xl border border-white/10 ${recordingState.isRecording ? 'rounded-t-none' : ''}`}>
                <div className="font-black italic tracking-widest text-[#F2C21A] text-lg sm:text-xl">
                    DJ<span className="text-white">MODE</span>
                    <span className="text-white/40 text-sm ml-2 font-normal not-italic tracking-normal">with {roomName || 'My Set'}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 font-mono text-[10px] sm:text-sm">
                    <button 
                        onClick={() => !recordingState.isRecording ? startRecording() : setShowRecordingPanel(!showRecordingPanel)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all font-black ${recordingState.isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-white/5 text-white/50 hover:bg-white/10 border border-white/5'}`}>
                        <Mic size={14} className={recordingState.isRecording ? 'animate-bounce' : ''} />
                        <span className="hidden xs:inline">{recordingState.isRecording ? 'LIVE RECORDING' : 'RECORD MIX'}</span>
                        <span className="xs:hidden">{recordingState.isRecording ? 'REC' : 'MIX'}</span>
                    </button>
                    <button
                        className="bg-red-500/20 text-red-400 px-3 py-1 sm:py-1.5 rounded-lg border border-red-500/30 hover:bg-red-500/30 transition-all font-black active:scale-95"
                        onClick={() => engineRef.current.sync.tap()}>
                        TAP
                    </button>
                    <div className="bg-black/40 px-3 py-1 sm:py-1.5 rounded-lg border border-white/5">
                        <span className="text-white/30 hidden sm:inline">MASTER </span>BPM: <span className="text-[#00FF88] font-black drop-shadow-[0_0_8px_#00FF88]">{engineRef.current?.sync?.masterBPM.toFixed(1) || '128.0'}</span>
                    </div>
                    <button
                        onClick={() => setShowPads(true)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg transition-all font-black bg-[#F2C21A]/10 text-[#F2C21A] hover:bg-[#F2C21A]/20 border border-[#F2C21A]/20 shadow-[0_0_15px_rgba(242,194,26,0.1)]`}>
                        <Layers size={14} />
                        <span>PADS</span>
                    </button>
                </div>
            </div>

            {/* Mobile Tab Bar (< 640px) */}
            <div className="flex sm:hidden gap-1 mb-3 bg-black/30 p-1 rounded-lg">
                {['A', 'mixer', 'B'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setMobileTab(tab)}
                        className={`flex-1 py-2 text-xs font-black rounded-md transition-all ${mobileTab === tab
                            ? tab === 'A' ? 'bg-[#00CFFF]/20 text-[#00CFFF] border border-[#00CFFF]/40'
                            : tab === 'B' ? 'bg-[#CC44FF]/20 text-[#CC44FF] border border-[#CC44FF]/40'
                            : 'bg-[#F2C21A]/20 text-[#F2C21A] border border-[#F2C21A]/40'
                            : 'text-white/30 hover:text-white/60'}`}>
                        {tab === 'mixer' ? 'MIXER' : `DECK ${tab}`}
                    </button>
                ))}
            </div>

            {/* Main DJ Layout */}
            <div className="flex flex-col sm:flex-row gap-3 flex-1 min-h-0">

                {/* Deck A */}
                <div className={`flex-1 min-w-0 ${mobileTab !== 'A' ? 'hidden sm:block' : ''}`}>
                    <DJDeck
                        label="A"
                        deckState={deckA}
                        engineDeck={engineRef.current?.decks?.A}
                        onControlChange={(ctrl, val, extra) => handleDeckControl('A', ctrl, val, extra)}
                        onLoadFile={(file) => handleFileLoad('A', file)}
                        expanded={deckAExpanded}
                        onToggleExpand={toggleDeckAExpand}
                        otherDeckExpanded={deckBExpanded}
                    />
                </div>

                {/* Mixer Center */}
                <div className={`flex-shrink-0 flex justify-center w-full sm:w-auto ${mobileTab !== 'mixer' ? 'hidden sm:flex' : ''}`}>
                    <DJMixer
                        state={mixerState}
                        onMixerChange={handleMixerChange}
                        deckAExpanded={deckAExpanded}
                        deckBExpanded={deckBExpanded}
                    />
                </div>

                {/* Deck B */}
                <div className={`flex-1 min-w-0 ${mobileTab !== 'B' ? 'hidden sm:block' : ''}`}>
                    <DJDeck
                        label="B"
                        deckState={deckB}
                        engineDeck={engineRef.current?.decks?.B}
                        onControlChange={(ctrl, val, extra) => handleDeckControl('B', ctrl, val, extra)}
                        onLoadFile={(file) => handleFileLoad('B', file)}
                        expanded={deckBExpanded}
                        onToggleExpand={toggleDeckBExpand}
                        otherDeckExpanded={deckAExpanded}
                    />
                </div>
            </div>

            {/* Bottom Pad Grid - Integrated for desktop, or overlay for mobile/tablet */}
            <div className={`hidden lg:block mt-auto`}>
                 <DJPads 
                    audioContext={engineRef.current?.ctx || audioContext} 
                    destination={engineRef.current?.masterGain || audioContext?.destination} 
                />
            </div>

            {/* Performance Pads Overlay */}
            {showPads && (
                <div className="fixed inset-0 z-[110] backdrop-blur-3xl bg-black/60 flex flex-col animate-in fade-in zoom-in duration-300">
                    <div className="flex justify-between items-center p-6 border-b border-white/5">
                         <div className="font-black italic tracking-widest text-[#F2C21A] text-xl">PERFORMANCE<span className="text-white">PADS</span></div>
                         <button 
                            onClick={() => setShowPads(false)}
                            className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/50 hover:text-white"
                         >
                            <X size={24} />
                         </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                        <div className="max-w-6xl w-full">
                            <DJPads 
                                audioContext={engineRef.current?.ctx || audioContext} 
                                destination={engineRef.current?.masterGain || audioContext?.destination} 
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Landscape Lockdown Overlay */}
            {isPortrait && (navigator.userAgent.includes('Mobile') || navigator.userAgent.includes('iPad')) && (
                <div className="fixed inset-0 z-[200] bg-[#050E1A] flex flex-col items-center justify-center text-center p-8">
                    <div className="w-24 h-24 mb-6 relative">
                         <div className="absolute inset-0 border-4 border-[#F2C21A]/30 rounded-2xl rotate-90 animate-pulse" />
                         <div className="absolute inset-4 border-2 border-[#F2C21A] rounded-lg animate-bounce" />
                    </div>
                    <h2 className="text-2xl font-black italic mb-2 tracking-widest">ROTATE DEVICE</h2>
                    <p className="text-white/40 text-sm max-w-[280px]">DJ Mode requires landscape orientation for a premium mixing experience.</p>
                </div>
            )}

            {/* Mix Recording Panel (Additive Layer) */}
            {showRecordingPanel && (
                <div className="fixed top-24 right-4 sm:right-6 w-[calc(100%-2rem)] sm:w-80 bg-[#0B1F33]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in slide-in-from-top-5 duration-300">
                    <div className="p-4 bg-white/5 border-b border-white/5 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className={`p-2 rounded-lg ${recordingState.isRecording ? 'bg-red-500/20' : 'bg-white/5'}`}>
                                <Mic size={18} className={recordingState.isRecording ? 'text-red-500 animate-pulse' : 'text-white/40'} />
                            </div>
                            <div>
                                <div className="text-[11px] font-black text-white">MIX RECORDING</div>
                                <div className="text-[8px] font-bold text-white/30 tracking-widest uppercase">
                                    {recordingState.isRecording ? 'Recording Live...' : 'Session Ready'}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setShowRecordingPanel(false)} className="text-white/20 hover:text-white/60 transition-colors">
                            <Square size={14} className="rotate-45" />
                        </button>
                    </div>

                    <div className="p-5 flex flex-col gap-4">
                        {/* Status & Timer */}
                        <div className="flex flex-col items-center py-4 bg-black/20 rounded-xl border border-white/5 relative overflow-hidden">
                            {/* Waveform Visualization Placeholder */}
                            <div className="absolute inset-0 flex items-center justify-around opacity-20 pointer-events-none px-4">
                                {Array(20).fill(0).map((_, i) => (
                                    <div key={i} className={`w-1 bg-red-500 rounded-full transition-all duration-150 ${recordingState.isRecording ? 'animate-bounce' : ''}`} 
                                         style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${i * 0.05}s` }} />
                                ))}
                            </div>
                            
                            <div className="text-4xl font-mono font-black text-white z-10 tabular-nums">
                                {formatRecordingTime(recordingState.time)}
                            </div>
                            <div className="text-[9px] font-black text-white/30 tracking-[0.3em] z-10 mt-1 uppercase">ELAPSED TIME</div>
                        </div>

                        {/* Metadata Input */}
                        <div className="flex flex-col gap-2">
                            <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">MIX NAME / METADATA</div>
                            <input 
                                type="text"
                                value={recordingState.projectName}
                                onChange={(e) => setRecordingState(prev => ({ ...prev, projectName: e.target.value }))}
                                className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-all"
                                placeholder="Summer Vibes Mix 2024"
                            />
                        </div>

                        {/* Controls */}
                        {!recordingState.blob ? (
                            <div className="flex gap-2">
                                {!recordingState.isRecording ? (
                                    <button 
                                        onClick={startRecording}
                                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20 flex items-center justify-center gap-2">
                                        <Play size={16} fill="currentColor" /> START SESSION
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={pauseRecording}
                                            className="flex-1 py-3 bg-white/10 text-white rounded-xl font-black text-xs hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                                            {recordingState.isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} fill="currentColor" />}
                                            {recordingState.isPaused ? 'RESUME' : 'PAUSE'}
                                        </button>
                                        <button 
                                            onClick={stopRecording}
                                            className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black text-xs hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                                            <Square size={16} fill="currentColor" /> STOP
                                        </button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3">
                                    <CheckCircle2 size={24} className="text-green-500" />
                                    <div>
                                        <div className="text-[11px] font-black text-white">RECORDING CAPTURED</div>
                                        <div className="text-[9px] font-bold text-white/40">Ready to save or share</div>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2">
                                    <button 
                                        onClick={saveRecording}
                                        className="flex-1 py-3 bg-white text-black rounded-xl font-black text-xs hover:bg-white/90 transition-all flex items-center justify-center gap-2">
                                        <Download size={16} /> SAVE MIX
                                    </button>
                                    <button 
                                        className="flex-1 py-3 bg-white/10 text-white rounded-xl font-black text-xs hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                                        <Share2 size={16} /> SHARE
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setRecordingState(prev => ({ ...prev, blob: null }))}
                                    className="text-[9px] font-black text-white/20 hover:text-white/40 transition-colors mt-2 uppercase tracking-widest flex items-center justify-center gap-1">
                                    <Trash2 size={10} /> Discard Session
                                </button>
                            </div>
                        )}
                        
                        {/* History Summary */}
                        {recordingHistory.length > 0 && (
                            <div className="mt-2 pt-4 border-t border-white/5">
                                <div className="text-[9px] font-black text-white/30 mb-2 uppercase tracking-[0.2em]">RECENT SESSIONS</div>
                                <div className="flex flex-col gap-1.5">
                                    {recordingHistory.slice(0, 2).map((rec, i) => (
                                        <div key={i} className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                                                <span className="text-[10px] text-white/60 truncate">{rec.name}</span>
                                            </div>
                                            <span className="text-[9px] font-mono text-white/30">{rec.duration}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
