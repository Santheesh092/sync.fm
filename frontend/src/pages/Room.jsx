import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import {
    Radio, ArrowLeft, Upload, Link2, Music, Share2, Copy, Mic, MicOff,
    Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, Square,
    Shuffle, Repeat
} from 'lucide-react';

import DevicePanel from '../components/DevicePanel';
import EqualizerPanel from '../components/EqualizerPanel';
import EffectsPanel from '../components/EffectsPanel';
import DimensionPanel from '../components/DimensionPanel';
import EarModePanel from '../components/EarModePanel';
import DJConsole from '../components/DJConsole';
import { createEQChain, applyEffect } from '../lib/effectUtils';
import { SyncEngine } from '../lib/syncEngine';
import { WebRTCManager } from '../lib/webrtc';

const SERVER_URL = 'http://localhost:3001';

// Memoized Waveform Strip for performance
const WaveformStrip = memo(({ title }) => {
    if (title === 'No track loaded') return null;
    return (
        <div className="absolute inset-0 flex items-center justify-center gap-[2px] px-2">
            {Array(100).fill(0).map((_, i) => {
                const hue = (i / 100) * 360;
                const barHeight = 15 + Math.abs(Math.sin(i * 0.15)) * 55 + Math.random() * 20;
                return (
                    <div key={i} className="w-[3px] rounded-full flex-shrink-0"
                        style={{
                            height: `${barHeight}%`,
                            background: `linear-gradient(to bottom, 
                                hsla(${hue}, 100%, 50%, 0) 0%, 
                                hsl(${hue}, 100%, 60%) 50%, 
                                hsla(${hue}, 100%, 50%, 0) 100%)`,
                            opacity: 1,
                            boxShadow: `0 0 12px hsla(${hue}, 100%, 60%, 0.4)`,
                            transition: 'opacity 0.2s'
                        }} />
                );
            })}
        </div>
    );
});

const BOTTOM_TABS = [
    { id: 'eq', label: 'EQ' },
    { id: 'effects', label: 'Effects' },
    { id: 'dimensions', label: 'Dimensions' },
    { id: 'dj', label: 'DJ Mode' },
    { id: 'ear', label: 'Ear Mode' },
];

export default function Room() {
    const { id: roomId } = useParams();
    const navigate = useNavigate();

    // ── Audio State ─────────────────────────────────────────────────────────
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.8);
    const [isMuted, setIsMuted] = useState(false);
    const [shuffle, setShuffle] = useState(false);
    const [loop, setLoop] = useState('none'); // 'none' | 'all' | 'one'
    const [trackInfo, setTrackInfo] = useState({ title: 'No track loaded', artist: '', url: null });
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(0);
    const [rotation, setRotation] = useState(0);
    const isJogging = useRef(false);
    const lastAngle = useRef(0);
    const [jogActive, setJogActive] = useState(false);
    const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Jog wheel animation
    useEffect(() => {
        let animId;
        const tick = () => {
            if (isPlaying && !isJogging.current) {
                // Assuming roughly 120 bpm for default rotation speed
                setRotation(r => (r + 0.5) % 360);
            }
            animId = requestAnimationFrame(tick);
        };
        animId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(animId);
    }, [isPlaying]);

    const handleJogStart = (e) => {
        isJogging.current = true;
        setJogActive(true);
        const rect = e.currentTarget.getBoundingClientRect();
        lastAngle.current = Math.atan2(
            e.clientY - (rect.top + rect.height / 2),
            e.clientX - (rect.left + rect.width / 2)
        );
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handleJogMove = (e) => {
        if (!isJogging.current || !audioRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const angle = Math.atan2(
            e.clientY - (rect.top + rect.height / 2),
            e.clientX - (rect.left + rect.width / 2)
        );
        let delta = angle - lastAngle.current;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        const deltaDeg = (delta * 180) / Math.PI;
        setRotation(r => (r + deltaDeg) % 360);

        // Scrub audio
        const scrubAmount = (deltaDeg / 360) * 1.8; // 1.8 seconds per rotation
        const newTime = Math.max(0, Math.min(duration, currentTime + scrubAmount));
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);

        lastAngle.current = angle;
    };

    const handleJogEnd = (e) => {
        isJogging.current = false;
        setJogActive(false);
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // ── Room / Device State ──────────────────────────────────────────────────
    const [devices, setDevices] = useState([]);
    const [roomInfo, setRoomInfo] = useState(null);
    const [bottomTab, setBottomTab] = useState('eq');
    const [rightTab, setRightTab] = useState('devices');
    const [shareUrl, setShareUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [isMicEnabled, setIsMicEnabled] = useState(false);
    const micStreamRef = useRef(null);
    const micSourceRef = useRef(null);

    // ── Refs ─────────────────────────────────────────────────────────────────
    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const gainRef = useRef(null);
    const eqFilters = useRef([]);
    const effectNodes = useRef({});
    const socketRef = useRef(null);
    const syncRef = useRef(null);
    const webrtcRef = useRef(null);
    const syncInterval = useRef(null);
    const sourceSetup = useRef(false);

    // ── Init Socket + Room ───────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(SERVER_URL);
        socketRef.current = socket;
        const sync = new SyncEngine(socket);
        syncRef.current = sync;

        socket.on('connect', async () => {
            await sync.measureOffset();
            sync.startContinuousSync();

            // Initialize WebRTC Manager
            const webrtc = new WebRTCManager(socket);
            webrtcRef.current = webrtc;

            const deviceName = navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop';
            socket.emit('room:create', {
                roomId,
                deviceName,
                deviceType: 'desktop',
            });
        });

        socket.on('room:joined', ({ state }) => {
            if (state) {
                setDevices(state.devices || []);
                setRoomInfo(state);
                setShareUrl(`${window.location.origin}/join/${roomId}`);
            }
        });

        socket.on('device:connected', async (device) => {
            setDevices(prev => {
                const exists = prev.find(d => d.id === device.id);
                return exists ? prev : [...prev, device];
            });

            // Start WebRTC connection if we are broadcasting (Mic)
            if (webrtcRef.current && isMicEnabled && micStreamRef.current) {
                await webrtcRef.current.createOffer(device.id, micStreamRef.current);
            }
        });

        socket.on('listener-joined', async ({ id }) => {
            if (webrtcRef.current && isMicEnabled && micStreamRef.current) {
                await webrtcRef.current.createOffer(id, micStreamRef.current);
            }
        });

        socket.on('device:disconnected', ({ deviceId }) => {
            setDevices(prev => prev.filter(d => d.id !== deviceId));
        });

        socket.on('device:latency', ({ deviceId, ms }) => {
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, latency: ms } : d));
        });

        // Handle legacy listener-joined event
        socket.on('listener-joined', ({ listenerId }) => {
            setDevices(prev => {
                if (!prev.find(d => d.id === listenerId)) {
                    return [...prev, {
                        id: listenerId, name: `Listener-${listenerId.slice(0, 4)}`,
                        type: 'mobile', joinedAt: Date.now(), latency: 0, volume: 1, muted: false, zone: 'A', isHost: false
                    }];
                }
                return prev;
            });
        });

        socket.on('listener-left', ({ listenerId }) => {
            setDevices(prev => prev.filter(d => d.id !== listenerId));
        });

        // Broadcast sync to all listeners every 500ms
        syncInterval.current = setInterval(() => {
            const audio = audioRef.current;
            if (!audio || !socket.connected) return;
            socket.emit('sync:broadcast', {
                position: audio.currentTime,
                isPlaying: !audio.paused,
                playbackRate: audio.playbackRate,
                trackId: trackInfo.url,
                serverTime: Date.now() + sync.offset,
            });
        }, 500);

        return () => {
            clearInterval(syncInterval.current);
            sync.destroy();
            socket.disconnect();
        };
    }, [roomId]);

    // ── Init Web Audio API ────────────────────────────────────────────────────
    const initAudioAPI = useCallback(() => {
        if (audioCtxRef.current) return;

        // Browsers require a user gesture to start AudioContext
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        audioCtxRef.current = ctx;

        const audio = audioRef.current;
        const source = ctx.createMediaElementSource(audio);

        // Build chain: source → gain → eq filters → effectFilter → panner → compressor → analyser → dest
        const gain = ctx.createGain();
        gain.gain.value = isMuted ? 0 : volume; // Fix: Set initial volume immediately
        gainRef.current = gain;

        const eqChain = createEQChain(ctx);
        eqFilters.current = eqChain;

        // Effect Chain Nodes setup
        const effectFilter = ctx.createBiquadFilter();
        const panner = ctx.createStereoPanner();
        const compressor = ctx.createDynamicsCompressor();
        const delay = ctx.createDelay(5.0);
        const convolver = ctx.createConvolver();
        const reverbNode = ctx.createConvolver(); // Additional convolver for Dimensions
        const effectGain = ctx.createGain(); // Wet/dry effect mix node

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;

        // Save nodes for applyEffect to route them dynamically
        effectNodes.current = {
            ctx,
            gain,
            eqOutput: eqChain[eqChain.length - 1], // Output from EQ
            analyser,
            effectFilter,
            panner,
            compressor,
            delay,
            convolver,
            reverbNode,
            effectGain,
            destination: ctx.destination
        };

        // Initial default route
        source.connect(gain);
        let node = gain;
        eqChain.forEach(f => { node.connect(f); node = f; });
        node.connect(analyser); // Direct to analyser until effect applies
        analyser.connect(ctx.destination);

        sourceSetup.current = true;
    }, []);

    // ── Audio Element Event Listeners ─────────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTime = () => setCurrentTime(audio.currentTime);
        const onMeta = () => setDuration(audio.duration);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            setIsPlaying(false);
            if (loop === 'one') audio.play();
            else handleNext();
        };

        audio.addEventListener('timeupdate', onTime);
        audio.addEventListener('loadedmetadata', onMeta);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        return () => {
            audio.removeEventListener('timeupdate', onTime);
            audio.removeEventListener('loadedmetadata', onMeta);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
        };
    }, [loop, queue, queueIndex]);

    // ── Volume / Mute ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (gainRef.current) {
            gainRef.current.gain.value = isMuted ? 0 : volume;
        } else if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    // ── Load Track ────────────────────────────────────────────────────────────
    const loadTrack = useCallback((url, title = 'Live Stream', artist = '') => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.src = url;
        audio.load();
        setTrackInfo({ url, title, artist });
        socketRef.current?.emit('control:track', { url, title, artist });
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        initAudioAPI();
        const url = URL.createObjectURL(file);
        const newEntry = { url, title: file.name.replace(/\.[^.]+$/, ''), artist: 'Local File' };
        const newQueue = [...queue, newEntry];
        setQueue(newQueue);
        loadTrack(url, newEntry.title, newEntry.artist);
    };



    const toggleMic = async () => {
        if (isMicEnabled) {
            // Disable Mic
            if (micSourceRef.current) {
                micSourceRef.current.disconnect();
                micSourceRef.current = null;
            }
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(track => track.stop());
                micStreamRef.current = null;
            }
            setIsMicEnabled(false);
        } else {
            // Enable Mic
            try {
                initAudioAPI();
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStreamRef.current = stream;

                if (audioCtxRef.current) {
                    const source = audioCtxRef.current.createMediaStreamSource(stream);
                    micSourceRef.current = source;
                    if (gainRef.current) {
                        source.connect(gainRef.current);
                    }
                }

                // Broadcast to all connected listeners
                if (webrtcRef.current) {
                    webrtcRef.current.updateStream(stream);
                    devices.forEach(d => {
                        webrtcRef.current.createOffer(d.id, stream);
                    });
                }

                setIsMicEnabled(true);
            } catch (err) {
                console.error("Error accessing microphone:", err);
                alert("Could not access microphone. Please check permissions.");
            }
        }
    };

    // ── Playback Controls ─────────────────────────────────────────────────────
    const handlePlay = () => {
        initAudioAPI();
        audioRef.current?.play();
        socketRef.current?.emit('control:play', { position: audioRef.current?.currentTime });
    };

    const handlePause = () => {
        audioRef.current?.pause();
        socketRef.current?.emit('control:pause', {});
    };

    const handleStop = () => {
        const audio = audioRef.current;
        if (!audio) return;
        audio.pause();
        audio.currentTime = 0;
    };

    const handleSeek = (pos) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = pos;
        socketRef.current?.emit('control:seek', { position: pos });
    };

    const handleNext = () => {
        if (queue.length === 0) return;
        const nextIdx = shuffle
            ? Math.floor(Math.random() * queue.length)
            : (queueIndex + 1) % queue.length;
        setQueueIndex(nextIdx);
        loadTrack(queue[nextIdx].url, queue[nextIdx].title, queue[nextIdx].artist);
        audioRef.current?.play();
    };

    const handlePrev = () => {
        if (queue.length === 0) return;
        const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
        setQueueIndex(prevIdx);
        loadTrack(queue[prevIdx].url, queue[prevIdx].title, queue[prevIdx].artist);
        audioRef.current?.play();
    };

    const handleLoop = () => {
        setLoop(l => l === 'none' ? 'all' : l === 'all' ? 'one' : 'none');
    };

    // ── Device Controls ───────────────────────────────────────────────────────
    const handleDeviceVolume = (deviceId, vol) => {
        socketRef.current?.emit('control:volume', { deviceId, volume: vol });
    };
    const handleDeviceMute = (deviceId) => {
        socketRef.current?.emit('control:mute', { deviceId });
    };
    const handleDeviceKick = (deviceId) => {
        socketRef.current?.emit('control:kick', { deviceId });
        setDevices(prev => prev.filter(d => d.id !== deviceId));
    };

    const handleCopyShare = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const fmt = (s) => {
        if (!s || isNaN(s)) return '0:00';
        return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #050E1A 0%, #0B1F33 100%)' }}>
            {/* Hidden audio element */}
            <audio ref={audioRef} crossOrigin="anonymous" preload="auto" />

            {/* ── Top Nav ── */}
            <nav className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(242,194,26,0.1)' }}>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/')}
                        className="p-0 flex items-center gap-1.5 text-sm bg-transparent border-none shadow-none hover:bg-transparent focus:outline-none"
                    >
                        <ArrowLeft size={14} />
                    </button>
                    <div className="flex items-center gap-2">
                        <Radio size={16} color="#F2C21A" />
                        <span className="font-bold text-sm">Nearby<span style={{ color: '#F2C21A' }}>.fm</span></span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold"
                        style={{ background: 'rgba(242,194,26,0.1)', border: '1px solid rgba(242,194,26,0.2)', color: '#F2C21A' }}>
                        {roomId}
                    </div>
                    <button onClick={handleCopyShare} className="btn-ghost px-3 py-2 flex items-center gap-1.5 text-xs">
                        {copied ? '✓' : <Copy size={12} />} {copied ? 'Copied' : 'Share'}
                    </button>
                    {isPlaying && (
                        <div className="flex items-center gap-1.5 text-xs font-bold text-red-400 animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-red-400" /> LIVE
                        </div>
                    )}
                </div>
            </nav>

            {/* ── Main 3-Column Layout ── */}
            <div className="flex flex-1 overflow-hidden room-layout">

                {/* ═══ LEFT — Track Queue ═══ */}
                <div className="w-64 flex-shrink-0 border-r p-4 flex flex-col hide-mobile"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(5,14,26,0.4)' }}>

                    {/* Jog Wheel */}
                    <div className="flex justify-center items-center mb-6 mt-2">
                        <div
                            className="relative rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing group/jog w-40 h-40"
                            style={{
                                background: 'repeating-conic-gradient(#1a1a1a 0 1deg, #111111 1deg 2deg)',
                                border: `8px solid #050505`,
                                boxShadow: jogActive
                                    ? `0 0 0 2px #F2C21A, 0 0 30px rgba(242,194,26,0.8), 0 10px 40px rgba(0,0,0,0.9)`
                                    : `0 10px 40px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.7)`,
                                transform: `rotate(${rotation}deg)`,
                                transition: 'box-shadow 0.2s'
                            }}
                            onPointerDown={handleJogStart}
                            onPointerMove={handleJogMove}
                            onPointerUp={handleJogEnd}
                            onPointerLeave={handleJogEnd}>

                            {/* Holographic Iridescent Vinyl Grooves */}
                            <div className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                                style={{
                                    background: 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff, #ff0000)',
                                    maskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)',
                                    WebkitMaskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)'
                                }} />

                            {/* Glossy Overlay for Vinyl */}
                            <div className="absolute inset-0 rounded-full pointer-events-none"
                                style={{ background: 'var(--glossy-overlay)', opacity: 0.2 }} />

                            <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
                            <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none" />

                            {/* Position Marker */}
                            <div className="absolute top-2 w-1.5 h-6 rounded-full pointer-events-none"
                                style={{ background: '#fff', boxShadow: `0 0 12px #fff, 0 0 20px #F2C21A` }} />

                            {/* Center Hub (Chrome Finish) */}
                            <div className="w-1/3 h-1/3 rounded-full flex items-center justify-center pointer-events-none relative overflow-hidden"
                                style={{
                                    background: 'var(--chrome-finish)',
                                    border: '2px solid rgba(255,255,255,0.2)',
                                    boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.5)'
                                }}>
                                {/* Hub Reflections */}
                                <div className="absolute inset-0 bg-white/10 blur-[2px] -rotate-45 translate-x-1/2" />
                                <Music size={16} color="#000" className="z-10 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Track info */}
                    <div className="text-center mb-4">
                        <h3 className="font-bold text-sm truncate">{trackInfo.title}</h3>
                        <p className="text-xs mt-1 truncate" style={{ color: '#6b8fa8' }}>{trackInfo.artist || 'Unknown Artist'}</p>
                    </div>

                    {/* Source buttons */}
                    {/* Source buttons (DJ Style) */}
                    <div className="flex gap-2 mb-6">
                        <label className="flex-1 cursor-pointer group/btn relative overflow-hidden h-10 flex items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                            <Upload size={14} color="#F2C21A" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">File</span>
                            <input type="file" accept="audio/*,.mp3,.wav,.flac,.ogg" onChange={handleFileUpload} className="hidden" />
                        </label>

                        <button
                            onClick={toggleMic}
                            className="flex-1 relative overflow-hidden h-10 flex items-center justify-center gap-2 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] group/btn"
                            style={{
                                background: isMicEnabled ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.03)',
                                border: isMicEnabled ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                boxShadow: isMicEnabled ? '0 0 15px rgba(239,68,68,0.2)' : '0 4px 15px rgba(0,0,0,0.2)'
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                            {isMicEnabled ? <Mic size={14} className="text-red-400" /> : <MicOff size={14} className="text-gray-400" />}
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isMicEnabled ? 'text-red-400' : 'text-gray-300'}`}>
                                {isMicEnabled ? 'Live' : 'Mic'}
                            </span>
                        </button>
                    </div>

                    {/* Queue */}
                    <div className="flex-1 overflow-y-auto space-y-1">
                        <div className="text-xs font-semibold mb-2 flex items-center justify-between" style={{ color: '#6b8fa8' }}>
                            <span>QUEUE</span>
                            <span>{queue.length} tracks</span>
                        </div>
                        {queue.length === 0 ? (
                            <p className="text-xs text-center py-4" style={{ color: '#6b8fa8' }}>Upload files to add to queue</p>
                        ) : queue.map((t, i) => (
                            <button key={i} onClick={() => { setQueueIndex(i); loadTrack(t.url, t.title, t.artist); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all
                  ${queueIndex === i ? 'bg-yellow-400/10 border border-yellow-400/30 text-yellow-300' : 'hover:bg-white/5 text-gray-300'}`}>
                                <div className="font-medium truncate">{t.title}</div>
                                <div className="opacity-60">{t.artist}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ═══ CENTER — Main Player ═══ */}
                <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
                    {/* Mobile Track Info & Jog Wheel */}
                    <div className="hide-desktop flex flex-col items-center">
                        {/* Jog Wheel (Mobile) */}
                        <div className="flex justify-center items-center mb-6 mt-2">
                            <div
                                className="relative rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing group/jog w-40 h-40"
                                style={{
                                    background: 'repeating-conic-gradient(#1a1a1a 0 1deg, #111111 1deg 2deg)',
                                    border: `8px solid #050505`,
                                    boxShadow: jogActive
                                        ? `0 0 0 2px #F2C21A, 0 0 30px rgba(242,194,26,0.8), 0 10px 40px rgba(0,0,0,0.9)`
                                        : `0 10px 40px rgba(0,0,0,0.9), inset 0 0 20px rgba(0,0,0,0.7)`,
                                    transform: `rotate(${rotation}deg)`,
                                    transition: 'box-shadow 0.2s'
                                }}
                                onPointerDown={handleJogStart}
                                onPointerMove={handleJogMove}
                                onPointerUp={handleJogEnd}
                                onPointerLeave={handleJogEnd}>

                                {/* Holographic Iridescent Vinyl Grooves */}
                                <div className="absolute inset-0 rounded-full opacity-40 pointer-events-none"
                                    style={{
                                        background: 'conic-gradient(from 0deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff, #ff0000)',
                                        maskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)',
                                        WebkitMaskImage: 'repeating-radial-gradient(circle, black 0px, black 1px, transparent 1px, transparent 2px)'
                                    }} />

                                {/* Glossy Overlay for Vinyl */}
                                <div className="absolute inset-0 rounded-full pointer-events-none"
                                    style={{ background: 'var(--glossy-overlay)', opacity: 0.2 }} />

                                <div className="absolute inset-2 rounded-full border border-white/10 pointer-events-none" />
                                <div className="absolute inset-10 rounded-full border border-white/5 pointer-events-none" />

                                {/* Position Marker */}
                                <div className="absolute top-2 w-1.5 h-6 rounded-full pointer-events-none"
                                    style={{ background: '#fff', boxShadow: `0 0 12px #fff, 0 0 20px #F2C21A` }} />

                                {/* Center Hub (Chrome Finish) */}
                                <div className="w-1/3 h-1/3 rounded-full flex items-center justify-center pointer-events-none relative overflow-hidden"
                                    style={{
                                        background: 'var(--chrome-finish)',
                                        border: '2px solid rgba(255,255,255,0.2)',
                                        boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5), 0 4px 10px rgba(0,0,0,0.5)'
                                    }}>
                                    {/* Hub Reflections */}
                                    <div className="absolute inset-0 bg-white/10 blur-[2px] -rotate-45 translate-x-1/2" />
                                    <Music size={16} color="#000" className="z-10 opacity-50" />
                                </div>
                            </div>
                        </div>

                        {/* Track info text */}
                        <div className="text-center w-full px-4 mb-2">
                            <h3 className="font-bold text-lg truncate">{trackInfo.title}</h3>
                            <p className="text-sm mt-1 truncate" style={{ color: '#6b8fa8' }}>{trackInfo.artist || 'Unknown Artist'}</p>
                        </div>
                    </div>

                    {/* DJ-Style Waveform + Seekbar */}
                    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2">
                        {/* Waveform strip */}
                        <div className="h-16 rounded-xl relative border overflow-hidden"
                            style={{ background: '#000', borderColor: `rgba(242,194,26,0.25)` }}>

                            <WaveformStrip title={trackInfo.title} />
                        </div>

                        {/* Seekbar */}
                        <div className="flex flex-col gap-0.5 px-1">
                            <div className="flex justify-between text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>
                                <span>{fmt(currentTime)}</span>
                                <span>{fmt(duration)}</span>
                            </div>
                            <input
                                type="range" min="0"
                                max={duration || 100} step="0.1"
                                value={currentTime}
                                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                                disabled={!trackInfo.url}
                                className={`w-full h-2 rounded-full appearance-none outline-none hide-thumb ${!trackInfo.url ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                                style={{
                                    background: progressPct > 0 && trackInfo.url
                                        ? `linear-gradient(to right, 
                                            #FF0000 0%, 
                                            #FF7F00 ${progressPct * 0.2}%, 
                                            #FFFF00 ${progressPct * 0.4}%, 
                                            #00FF00 ${progressPct * 0.6}%, 
                                            #00CFFF ${progressPct * 0.8}%, 
                                            #CC44FF ${progressPct}%, 
                                            rgba(255,255,255,0.08) ${progressPct}%, 
                                            rgba(255,255,255,0.08) 100%)`
                                        : 'rgba(255,255,255,0.08)'
                                }}
                            />
                        </div>
                    </div>

                    {/* Integrated Player Controls and Volume */}
                    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-6">

                        {/* Transport Controls (DJ Style) */}
                        <div className="flex items-center justify-center gap-6 py-2">
                            <button
                                onClick={() => setShuffle(!shuffle)}
                                disabled={!trackInfo.url}
                                className={`p-2 rounded-full transition-all ${!trackInfo.url ? 'opacity-20 cursor-not-allowed' : shuffle ? 'text-blue-400 bg-blue-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Shuffle size={18} />
                            </button>

                            <button
                                onClick={handlePrev}
                                disabled={!trackInfo.url}
                                className={`p-3 rounded-full transition-all ${!trackInfo.url ? 'opacity-20 cursor-not-allowed text-gray-500' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                            >
                                <SkipBack size={24} fill="currentColor" />
                            </button>

                            <button
                                onClick={isPlaying ? handlePause : handlePlay}
                                disabled={!trackInfo.url}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all group relative ${!trackInfo.url ? 'opacity-40 cursor-not-allowed' : ''}`}
                                style={{
                                    background: !trackInfo.url
                                        ? 'rgba(255,255,255,0.1)'
                                        : isPlaying
                                            ? 'linear-gradient(135deg, #FF4444 0%, #CC0000 100%)'
                                            : 'linear-gradient(135deg, #00CFFF 0%, #0088AA 100%)',
                                    boxShadow: !trackInfo.url
                                        ? 'none'
                                        : isPlaying
                                            ? '0 0 20px rgba(255,68,68,0.4), inset 0 2px 4px rgba(255,255,255,0.3)'
                                            : '0 0 20px rgba(0,207,255,0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
                                    border: '2px solid rgba(255,255,255,0.1)'
                                }}
                            >
                                <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 bg-white transition-opacity" />
                                {isPlaying ? (
                                    <Pause size={32} fill="#FFF" color="#FFF" />
                                ) : (
                                    <Play size={32} fill="#FFF" color="#FFF" className="ml-1" />
                                )}
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={!trackInfo.url}
                                className={`p-3 rounded-full transition-all ${!trackInfo.url ? 'opacity-20 cursor-not-allowed text-gray-500' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
                            >
                                <SkipForward size={24} fill="currentColor" />
                            </button>

                            <button
                                onClick={handleLoop}
                                disabled={!trackInfo.url}
                                className={`p-2 rounded-full transition-all relative ${!trackInfo.url ? 'opacity-20 cursor-not-allowed' : loop !== 'none' ? 'text-green-400 bg-green-400/10' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <Repeat size={18} />
                                {loop === 'one' && <span className="absolute -top-1 -right-1 text-[8px] font-bold bg-green-500 text-black px-1 rounded-full">1</span>}
                            </button>
                        </div>

                        {/* Volume Control */}
                        <div className="flex flex-col gap-2 px-2 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex justify-between items-center mb-1">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setIsMuted(v => !v)} className="transition-all" style={{ color: isMuted ? '#FF4444' : '#00CFFF' }}>
                                        {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
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
                                onChange={e => setVolume(parseFloat(e.target.value))}
                                className="w-full h-2 rounded-full appearance-none outline-none cursor-pointer hide-thumb"
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
                    </div>

                    {/* Mobile action bar for source/share - Polished DJ Style */}
                    <div className="hide-desktop grid grid-cols-3 gap-2 p-1">
                        <label className="group relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 cursor-pointer overflow-hidden shadow-xl"
                            style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(10px)'
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-8 h-8 rounded-full bg-yellow-400/10 flex items-center justify-center border border-yellow-400/20">
                                <Upload size={14} className="text-yellow-400" />
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tighter text-gray-400">Add Audio</span>
                            <input type="file" accept="audio/*,.mp3,.wav,.flac,.ogg" onChange={handleFileUpload} className="hidden" />
                        </label>

                        <button
                            onClick={toggleMic}
                            className="group relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 overflow-hidden shadow-xl"
                            style={{
                                background: isMicEnabled ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)',
                                border: isMicEnabled ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                                backdropFilter: 'blur(10px)'
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isMicEnabled ? 'bg-red-500/20 border-red-500/40 animate-pulse' : 'bg-white/5 border-white/10'}`}>
                                {isMicEnabled ? <Mic size={14} className="text-red-400" /> : <MicOff size={14} className="text-gray-500" />}
                            </div>
                            <span className={`text-[9px] font-black uppercase tracking-tighter ${isMicEnabled ? 'text-red-400' : 'text-gray-400'}`}>
                                {isMicEnabled ? 'Live Mic' : 'Mic Off'}
                            </span>
                        </button>

                        <button
                            onClick={handleCopyShare}
                            className="group relative flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95 overflow-hidden shadow-xl"
                            style={{
                                background: 'rgba(0, 207, 255, 0.1)',
                                border: '1px solid rgba(0, 207, 255, 0.3)',
                                backdropFilter: 'blur(10px)'
                            }}>
                            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="w-8 h-8 rounded-full bg-[#00CFFF]/20 flex items-center justify-center border border-[#00CFFF]/40">
                                {copied ? <div className="text-[10px] font-bold text-[#00CFFF]">✓</div> : <Share2 size={14} className="text-[#00CFFF]" />}
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-tighter text-[#00CFFF]">
                                {copied ? 'Copied' : 'Share'}
                            </span>
                        </button>
                    </div>

                    {/* Bottom Tabs */}
                    <div className="glass-panel rounded-2xl overflow-hidden">
                        <div className="tab-bar m-2">
                            {BOTTOM_TABS.map(t => (
                                <button key={t.id} onClick={() => setBottomTab(t.id)}
                                    className={`tab-btn ${bottomTab === t.id ? 'active' : ''}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ minHeight: 260 }}>
                            <div style={{ display: bottomTab === 'eq' ? 'block' : 'none' }}>
                                <EqualizerPanel filters={eqFilters.current} />
                            </div>
                            <div style={{ display: bottomTab === 'effects' ? 'block' : 'none' }}>
                                <EffectsPanel audioNodes={effectNodes.current} onInitAudio={initAudioAPI} />
                            </div>
                            <div style={{ display: bottomTab === 'dimensions' ? 'block' : 'none' }}>
                                <DimensionPanel
                                    audioNodes={effectNodes.current}
                                    trackUrl={trackInfo.url}
                                    trackTitle={trackInfo.title}
                                />
                            </div>
                            <div style={{ display: bottomTab === 'dj' ? 'block' : 'none' }}>
                                <DJConsole audioContext={audioCtxRef.current} />
                            </div>
                            <div style={{ display: bottomTab === 'ear' ? 'block' : 'none' }}>
                                <EarModePanel filters={eqFilters.current} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══ RIGHT — Device Panel ═══ */}
                <div className="w-72 flex-shrink-0 border-l p-4 flex flex-col hide-mobile"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(5,14,26,0.4)' }}>
                    <DevicePanel
                        devices={devices}
                        onVolumeChange={handleDeviceVolume}
                        onMute={handleDeviceMute}
                        onKick={handleDeviceKick}
                    />

                    {/* Room Info */}
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                        <div className="text-xs font-semibold mb-3 flex items-center gap-1.5" style={{ color: '#6b8fa8' }}>
                            <Share2 size={12} /> Share Room
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1 text-xs font-mono px-2 py-2 rounded-lg truncate"
                                style={{ background: 'rgba(5,14,26,0.6)', border: '1px solid rgba(255,255,255,0.06)', color: '#6b8fa8' }}>
                                {shareUrl || `${window.location.origin}/join/${roomId}`}
                            </div>
                            <button onClick={handleCopyShare} className="btn-ghost px-3 py-2 flex-shrink-0 text-xs">
                                {copied ? '✓' : <Copy size={12} />}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

        </div>
    );
}
