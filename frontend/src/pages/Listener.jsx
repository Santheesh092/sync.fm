import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Headphones, Volume2, VolumeX, Activity, Radio, ArrowLeft, Music } from 'lucide-react';
import { SyncEngine } from '../lib/syncEngine';
import { WebRTCManager } from '../lib/webrtc';
import { createEQChain } from '../lib/effectUtils';
import DevicePanel from '../components/DevicePanel';
import EqualizerPanel from '../components/EqualizerPanel';
import EffectsPanel from '../components/EffectsPanel';
import EarModePanel from '../components/EarModePanel';
import DimensionPanel from '../components/DimensionPanel';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || isIOS;

// Memoized Waveform Strip for performance
const WaveformStrip = memo(({ active }) => {
    if (!active) return null;
    return (
        <div className="h-16 rounded-xl relative border overflow-hidden" 
            style={{ background: '#000', borderColor: 'rgba(0, 207, 255, 0.25)' }}>
            <div className="absolute inset-0 flex items-center justify-center gap-[2.5px] px-2 opacity-80">
                {Array(80).fill(0).map((_, i) => {
                    const hue = 180 + (i / 80) * 40; // Cyan-ish range
                    const barHeight = 20 + Math.abs(Math.sin(i * 0.2)) * 50 + Math.random() * 20;
                    return (
                        <div key={i} className="w-[3px] rounded-full flex-shrink-0"
                            style={{
                                height: `${barHeight}%`,
                                background: `linear-gradient(to bottom, 
                                    hsla(${hue}, 100%, 50%, 0) 0%, 
                                    hsl(${hue}, 100%, 65%) 50%, 
                                    hsla(${hue}, 100%, 50%, 0) 100%)`,
                                boxShadow: `0 0 10px hsla(${hue}, 100%, 65%, 0.3)`
                            }} />
                    );
                })}
            </div>
        </div>
    );
});

const SERVER_URL = '';

const STATUS_TEXT = {
    connecting: 'Connecting to room audio...',
    syncing: 'Syncing with host...',
    joining: 'Connecting to room audio...',
    waiting: 'Waiting for host...',
    playing: 'Playing',
    paused: 'Paused',
    error: 'Connection error',
};

export default function Listener() {
    const { id: roomId } = useParams();
    const navigate = useNavigate();

    const [status, setStatus] = useState('connecting');
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(0.8);
    const [trackInfo, setTrackInfo] = useState({ title: 'Waiting for host…', artist: '' });
    const [latency, setLatency] = useState(null);
    const [activeTab, setActiveTab] = useState('eq');
    const [alert, setAlert] = useState(null);
    const [audioSuspended, setAudioSuspended] = useState(false);
    const [isConnected, setIsConnected] = useState(false);

    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const hasInteractedRef = useRef(false);
    const gainRef = useRef(null);
    const analyserRef = useRef(null);
    const eqFilters = useRef([]);
    const effectNodes = useRef({});
    const socketRef = useRef(null);
    const syncRef = useRef(null);
    const webrtcRef = useRef(null);
    const latencyRef = useRef(null);
    const currentTrackIdRef = useRef(null);

    // ── Web Audio Setup ──────────────────────────────────────────────────────
    const initAudio = useCallback(() => {
        if (audioCtxRef.current) return;
        const audio = audioRef.current;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;

        const source = ctx.createMediaElementSource(audio);
        const eqChain = createEQChain(ctx);
        eqFilters.current = eqChain;

        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(volume, ctx.currentTime);
        gainRef.current = masterGain;

        // --- Protective Master Limiter (Prevents crackling/distortion) ---
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.setValueAtTime(-1.0, ctx.currentTime); // Threshold -1dB
        limiter.knee.setValueAtTime(0, ctx.currentTime);
        limiter.ratio.setValueAtTime(20, ctx.currentTime); // Hard limiting
        limiter.attack.setValueAtTime(0.003, ctx.currentTime);
        limiter.release.setValueAtTime(0.1, ctx.currentTime);

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Keep nodes for effects and dimensions
        effectNodes.current = { 
            ctx, 
            gain: masterGain,
            eqOutput: eqChain[eqChain.length - 1],
            analyser,
            effectFilter: ctx.createBiquadFilter(), 
            panner: ctx.createStereoPanner(), 
            compressor: ctx.createDynamicsCompressor(),
            delay: ctx.createDelay(5.0),
            convolver: ctx.createConvolver(),
            reverbNode: ctx.createConvolver(),
            effectGain: ctx.createGain(),
            destination: ctx.destination
        };

        // Routing: source -> eqChain -> limiter -> masterGain -> analyser -> destination
        source.connect(eqChain[0]);
        let lastEqNode = eqChain[eqChain.length - 1];
        lastEqNode.connect(limiter);
        limiter.connect(masterGain);
        masterGain.connect(analyser);
        analyser.connect(ctx.destination);
    }, [volume]);

    // ── Socket + Sync Init ───────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(SERVER_URL);
        socketRef.current = socket;
        const sync = new SyncEngine(socket);
        syncRef.current = sync;
        sync.attachAudio(audioRef.current);

        socket.on('connect', async () => {
            setIsConnected(true);
            setStatus('syncing');
            setIsSyncing(true);
            await sync.measureOffset();
            setIsSyncing(false);
            sync.startContinuousSync(isMobile ? 10000 : 5000);

            setStatus('joining');
            socket.emit('room:join', {
                roomId,
                deviceName: isMobile ? 'Mobile Device' : 'Web Browser',
                deviceType: isMobile ? 'mobile' : 'desktop',
            });
        });
        
        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('room:joined', ({ state }) => {
            setStatus('waiting');
            if (state?.track?.url) {
                setTrackInfo({ title: state.track.title, artist: state.track.artist });
                if (audioRef.current) {
                    audioRef.current.src = state.track.url;
                    currentTrackIdRef.current = state.track.url;
                }
            }
        });

        socket.on('error', ({ message }) => {
            setStatus('error');
            window.alert(message);
            navigate('/join-room');
        });

        socket.on('party-closed', () => {
            navigate('/');
        });
        socket.on('room:closed', () => {
            navigate('/');
        });
        socket.on('room:kicked', () => {
            window.alert('You were removed from the room.');
            navigate('/');
        });

        // ── Sync handler ──
        socket.on('sync:broadcast', (data) => {
            if (!hasInteractedRef.current) { 
                if (status !== 'waiting') setStatus('waiting');
                return; 
            }
            const audio = audioRef.current;
            if (!audio) return;

            // Load new track if changed (compare filename/relative path, not absolute audio.src)
            // Skip this if WebRTC is actively providing a stream (srcObject is present)
            if (!audio.srcObject && data.trackId && currentTrackIdRef.current !== data.trackId) {
                console.log(`[Listener] Track changed to: ${data.trackId}`);
                audio.src = data.trackId;
                audio.load();
                currentTrackIdRef.current = data.trackId;

                // After load(), readyState drops to 0 so applySync's play guard would fail.
                // Defer the sync until the browser says it can play the new track.
                const onCanPlay = () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    sync.applySync(data);
                    setStatus(data.isPlaying ? 'playing' : 'paused');
                };
                audio.addEventListener('canplay', onCanPlay);
                // Still update the status label immediately so the UI feels responsive
                setStatus(data.isPlaying ? 'playing' : 'paused');
                return; // skip the immediate applySync below
            }

            sync.applySync(data);
            setStatus(data.isPlaying ? 'playing' : 'paused');

            // Measure our latency from the server timestamp
            const lag = Math.abs(performance.now() + sync.offset - data.serverTime);
            setLatency(Math.round(lag));

            // Ack with latency
            socket.emit('sync:ack', { latency: lag });
        });

        // ── Track info ──
        socket.on('control:track', (data) => {
            setTrackInfo({ title: data.title || 'Unknown', artist: data.artist || '' });
            if (audioRef.current && data.url) {
                const audio = audioRef.current;
                audio.src = data.url;
                audio.load(); // Start buffering immediately so readyState >= 2 when sync arrives
                currentTrackIdRef.current = data.url;
                // If the listener already interacted (autoplay unlocked), attempt to play immediately
                if (hasInteractedRef.current) {
                    audio.play().then(() => {
                        setStatus('playing');
                    }).catch((e) => {
                        // Play may fail due to autoplay policies; we'll rely on the next sync packet
                        console.warn('[Listener] Autoplay after track change was blocked:', e);
                    });
                }
            }
        });

        // ── Volume/mute from host ──
        socket.on('control:volume', ({ volume: v }) => setVolume(v));
        socket.on('control:mute', ({ muted }) => setIsMuted(muted));

        // ── Alert ──
        socket.on('room:alert', (alertData) => setAlert(alertData));

        // ── WebRTC (for mic broadcasts from host) ──
        const webrtc = new WebRTCManager(socket);
        webrtcRef.current = webrtc;
        webrtc.onTrack = (stream) => {
            if (!audioRef.current) return;
            // Native fallback prevention: if WebRTC works, disable sync offset for URL playback
            sync.destroy();
            
            audioRef.current.srcObject = stream;
            initAudio();
            audioRef.current.play().catch(() => { });
            setStatus('playing');
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (syncRef.current && status === 'playing') {
                    syncRef.current.measureOffset();
                }
                if (audioCtxRef.current && audioCtxRef.current.state === 'suspended' && hasInteractedRef.current) {
                    setAudioSuspended(true);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            sync.destroy();
            socket.disconnect();
            webrtcRef.current?.disconnectAll();
        };
    }, [roomId, navigate]);

    // ── Volume Effect ────────────────────────────────────────────────────────
    useEffect(() => {
        if (gainRef.current) gainRef.current.gain.value = isMuted ? 0 : volume;
        else if (audioRef.current) audioRef.current.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    const handleInteract = () => {
        setHasInteracted(true);
        hasInteractedRef.current = true;
        
        // 1. Prime the audio element with a tiny silent WAV (unlocks it for future play() calls)
        const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        const audio = audioRef.current;
        if (audio && !audio.src) {
            audio.src = silentWav;
            audio.play().then(() => {
                console.log('[Listener] Audio element primed with user gesture');
            }).catch(e => console.warn('[Listener] Priming failed:', e));
        }

        // 2. Initialize the Web Audio API context
        initAudio();
        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume().then(() => {
                console.log('[Listener] AudioContext resumed');
                setAudioSuspended(false);
            });
        } else {
            setAudioSuspended(false);
        }
        
        // 3. Re-trigger actual track if already set
        if (audio && audio.src && audio.src !== silentWav) {
            audio.play()
                .then(() => console.log('[Listener] Playback resumed after interaction'))
                .catch(e => console.warn('[Listener] Playback resumed failed:', e));
        }
    };

    // ── Tap-to-start gate ────────────────────────────────────────────────────
    const renderGate = () => {
        if (hasInteracted) return null;
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[#050E1A]">
                <div className="glass-panel p-10 rounded-[32px] text-center max-w-sm w-full animate-slide-up relative overflow-hidden"
                    style={{ 
                        border: '1px solid rgba(0, 207, 255, 0.2)',
                        background: 'rgba(5, 14, 26, 0.7)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4), inset 0 0 20px rgba(0, 207, 255, 0.05)'
                    }}>
                    <div className="absolute -top-20 -left-20 w-40 h-40 bg-[#00CFFF] opacity-10 blur-[80px]" />
                    <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-[#F2C21A] opacity-10 blur-[80px]" />

                    <div className="w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center relative shadow-[0_0_30px_rgba(0,207,255,0.2)]"
                        style={{ 
                            background: 'linear-gradient(135deg, rgba(0, 207, 255, 0.1) 0%, rgba(0, 207, 255, 0.05) 100%)', 
                            border: '1px solid rgba(0, 207, 255, 0.3)' 
                        }}>
                        <Headphones size={44} className="text-[#00CFFF] animate-pulse" />
                        <div className="absolute inset-0 rounded-full border border-[#00CFFF] opacity-20 animate-ping" />
                    </div>

                    <h2 className="text-3xl font-black mb-3 tracking-tight text-white">Join the Mix</h2>
                    <p className="text-sm font-medium mb-2" style={{ color: '#6b8fa8' }}>
                        Room <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-[#F2C21A]">{roomId?.toUpperCase()}</span>
                    </p>
                    <p className="text-sm mb-10 leading-relaxed" style={{ color: '#6b8fa8' }}>
                        Experience synchronized high-fidelity audio direct from the host console.
                    </p>

                    <button 
                        onClick={!isIOS ? handleInteract : undefined}
                        onTouchEnd={isIOS ? handleInteract : undefined}
                        className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm tracking-wider uppercase transition-all hover:scale-[1.02] active:scale-95 group relative overflow-hidden"
                        style={{ background: 'linear-gradient(90deg, #00CFFF, #0087FF)', boxShadow: '0 8px 20px rgba(0, 207, 255, 0.3)' }}>
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-[-20deg]" />
                        <Music size={18} /> Tap anywhere to enable audio
                    </button>
                </div>
            </div>
        );
    };

    const isLive = status === 'playing';

    return (
        <div className="min-h-screen flex flex-col bg-[#050E1A] text-white overflow-hidden">
            <audio ref={audioRef} preload="auto" crossOrigin="anonymous" />

            {!hasInteracted ? renderGate() : (
                <>
            {/* Alert Banner */}
            {alert && (
                <div className="alert-banner m-4 flex items-center gap-3 animate-slide-down">
                    <span className="text-2xl">{alert.emoji || '🚨'}</span>
                    <div>
                        <div className="font-bold text-red-500">{alert.type || 'ALERT'}</div>
                        <div className="text-sm">{alert.message}</div>
                    </div>
                    <button onClick={() => setAlert(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
                </div>
            )}

            {audioSuspended && (
                <div className="m-4 flex items-center gap-3 animate-slide-down bg-yellow-500/20 border border-yellow-500 p-4 rounded-xl cursor-pointer" onClick={handleInteract}>
                    <span className="text-2xl">⏸️</span>
                    <div>
                        <div className="font-bold text-yellow-500">Audio paused — tap to resume</div>
                        <div className="text-sm">Your browser paused the audio. Tap here to resume playback.</div>
                    </div>
                </div>
            )}

            {/* ═══ Header ═══ */}
            <header className="h-16 px-6 flex items-center justify-between border-b relative z-10 sticky top-0"
                style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(5, 14, 26, 0.8)', backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-4">
                    <button onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-white/5 transition-colors" style={{ color: '#6b8fa8' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#00CFFF]">Listener Mode</span>
                        <h1 className="text-sm font-bold truncate max-w-[120px] md:max-w-none text-white">{roomId?.toUpperCase()}</h1>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Sync Indicator */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/5 bg-white/5 shadow-inner">
                        <div className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px] ${!isConnected ? 'bg-[#FF4444] shadow-[#FF4444]' : latency < 300 ? 'bg-[#00FF94] shadow-[#00FF94]' : 'bg-[#F2C21A] shadow-[#F2C21A]'}`} />
                        <span className="text-[10px] font-bold tracking-tighter uppercase" style={{ color: '#6b8fa8' }}>
                            {!isConnected ? 'Reconnecting...' : latency === null ? 'Connecting...' : latency < 300 ? 'You are in sync' : 'Syncing...'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#00CFFF]/20 bg-[#00CFFF]/5">
                        <div className="flex gap-[1px]">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`w-0.5 h-2 bg-[#00CFFF] rounded-full ${isLive ? 'animate-bounce' : ''}`} style={{ animationDelay: `${i * 0.1}s` }} />
                            ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-[#00CFFF]">{STATUS_TEXT[status] || status}</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 room-layout relative">
                <div className="max-w-lg mx-auto flex flex-col gap-6">

                    {/* Main Stage UI */}
                    <div className="glass-panel rounded-[40px] p-8 flex flex-col items-center gap-8 relative overflow-hidden transition-all duration-500"
                        style={{ 
                            background: 'rgba(11, 53, 83, 0.2)', 
                            border: '1px solid rgba(0, 207, 255, 0.15)',
                            boxShadow: '0 30px 60px rgba(0,0,0,0.5)'
                        }}>
                        
                        {/* Glow Background */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/2 bg-[#00CFFF] opacity-5 blur-[100px] pointer-events-none" />

                        {/* Status Orb */}
                        <div className="w-56 h-56 rounded-full flex items-center justify-center relative group">
                            <div className={`absolute inset-0 rounded-full border border-[#00CFFF]/20 ${isLive ? 'animate-spin-slow opacity-100' : 'opacity-20'}`} 
                                style={{ borderStyle: 'dashed', borderWidth: '2px' }} />
                            
                            {/* Inner Circle */}
                            <div className="w-40 h-40 rounded-full flex flex-col items-center justify-center gap-2 relative z-10 border border-white/10 shadow-[inner_0_0_30px_rgba(0,0,0,0.4)]"
                                style={{ background: 'rgba(5, 14, 26, 0.6)' }}>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-700 ${isLive ? 'bg-[#00CFFF] shadow-[0_0_30px_#00CFFF]' : 'bg-white/5'}`}>
                                    <Headphones size={24} className={`${isLive ? 'text-black' : 'text-white/40'}`} />
                                </div>
                                <div className="text-center px-4">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b8fa8] mb-1">Channel</div>
                                    <div className={`text-lg font-black uppercase tracking-tighter transition-colors duration-500 ${isLive ? 'text-white' : 'text-white/20'}`}>
                                        {status === 'playing' ? 'Live Mix' : status === 'paused' ? 'Paused' : 'Offline'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Track Info */}
                        <div className="text-center relative z-10 w-full px-4">
                            <h2 className="text-2xl font-black text-white mb-2 tracking-tight line-clamp-2">
                                {trackInfo.title || 'Waiting for broadcast...'}
                            </h2>
                            <p className="text-[#00CFFF] text-xs font-bold uppercase tracking-[0.3em] opacity-70">
                                {trackInfo.artist || 'Room Host'}
                            </p>
                        </div>
                    </div>

                    {/* Waveform */}
                    <WaveformStrip active={isLive} />

                    {/* Volume Controller (DJ Style) */}
                    <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'rgba(5,14,26,0.4)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex justify-between items-center px-1">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setIsMuted(v => !v)} className="transition-all" style={{ color: isMuted ? '#FF4444' : '#00CFFF' }}>
                                    {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                                </button>
                                <span className="text-[10px] font-bold tracking-widest text-[#00CFFF] uppercase">Output Gain</span>
                            </div>
                            <span className="text-[10px] font-mono font-black" style={{ color: isMuted ? '#FF4444' : '#00CFFF' }}>
                                {Math.round((isMuted ? 0 : volume) * 100)}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={isMuted ? 0 : volume}
                            onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                            className="w-full h-2 rounded-full appearance-none outline-none cursor-pointer"
                            style={{
                                background: `linear-gradient(to right, 
                                    #00CFFF 0%, 
                                    #00CFFF ${(isMuted ? 0 : volume) * 100}%, 
                                    rgba(255,255,255,0.08) ${(isMuted ? 0 : volume) * 100}%, 
                                    rgba(255,255,255,0.08) 100%)`,
                                boxShadow: isMuted ? 'none' : `0 0 10px rgba(0,207,255, ${volume * 0.3})`
                            }}
                        />
                    </div>

                    {/* Controls Tabs (EQ/FX/EAR/DIM) */}
                    <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                        {['eq', 'effects', 'dimensions', 'ear'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab === activeTab ? null : tab)}
                                className={`flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                                    activeTab === tab 
                                    ? 'bg-[#00CFFF] text-black shadow-[0_0_15px_rgba(0,207,255,0.4)]' 
                                    : 'text-[#6b8fa8] hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Active Tab Panel */}
                    <div className={`transition-all duration-300 ${activeTab ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95 pointer-events-none absolute'}`}>
                        {activeTab === 'eq' && <EqualizerPanel filters={eqFilters.current} />}
                        {activeTab === 'effects' && <EffectsPanel audioNodes={effectNodes.current} onInitAudio={() => {}} />}
                        {activeTab === 'dimensions' && (
                            <DimensionPanel 
                                audioNodes={effectNodes.current} 
                                trackUrl={audioRef.current?.src}
                                trackTitle={trackInfo.title}
                            />
                        )}
                        {activeTab === 'ear' && <EarModePanel filters={eqFilters.current} />}
                    </div>

                </div>
            </main>
            </>
            )}
        </div>
    );
}
