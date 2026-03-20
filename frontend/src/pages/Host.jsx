import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { WebRTCManager } from '../lib/webrtc';
import { Mic, Upload, Users, Copy, Radio, Activity, StopCircle } from 'lucide-react';

const SERVER_URL = '';

export default function Host() {
    const [partyId, setPartyId] = useState(null);
    const [listenersCount, setListenersCount] = useState(0);
    const [isLive, setIsLive] = useState(false);
    const [audioSource, setAudioSource] = useState(null); // 'mic' or 'file'

    const socketRef = useRef(null);
    const webrtcRef = useRef(null);
    const audioContextRef = useRef(null);
    const destinationNodeRef = useRef(null);
    const mediaElementRef = useRef(null);

    const navigate = useNavigate();

    useEffect(() => {
        // Initialize Socket
        socketRef.current = io(SERVER_URL);
        webrtcRef.current = new WebRTCManager(socketRef.current);

        socketRef.current.on('connect', () => {
            socketRef.current.emit('create-party');
        });

        socketRef.current.on('party-created', ({ partyId }) => {
            setPartyId(partyId);
        });

        socketRef.current.on('listener-joined', async ({ listenerId }) => {
            setListenersCount(c => c + 1);
            // Initiate WebRTC connection to the new listener
            if (webrtcRef.current && webrtcRef.current.localStream) {
                await webrtcRef.current.createOffer(listenerId, webrtcRef.current.localStream);
            } else {
                await webrtcRef.current.createOffer(listenerId, null);
            }
        });

        socketRef.current.on('listener-left', () => {
            setListenersCount(c => Math.max(0, c - 1));
        });

        return () => {
            if (webrtcRef.current) webrtcRef.current.disconnectAll();
            if (socketRef.current) socketRef.current.disconnect();
            if (audioContextRef.current) audioContextRef.current.close();
            if (mediaElementRef.current) {
                mediaElementRef.current.pause();
                mediaElementRef.current.src = '';
            }
        };
    }, []);

    const startMicBroadcast = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setupBroadcast(stream, 'mic');
        } catch (err) {
            console.error('Error accessing microphone', err);
            alert('Could not access microphone');
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }

        // Create an audio element to play the file
        if (!mediaElementRef.current) {
            mediaElementRef.current = new Audio();
        }

        const objectUrl = URL.createObjectURL(file);
        mediaElementRef.current.src = objectUrl;
        mediaElementRef.current.loop = true;

        // Use Web Audio API to capture the stream
        const track = audioContextRef.current.createMediaElementSource(mediaElementRef.current);
        destinationNodeRef.current = audioContextRef.current.createMediaStreamDestination();

        track.connect(destinationNodeRef.current);
        track.connect(audioContextRef.current.destination); // Play locally as well

        await mediaElementRef.current.play();
        setupBroadcast(destinationNodeRef.current.stream, 'file');
    };

    const setupBroadcast = (stream, source) => {
        setAudioSource(source);
        setIsLive(true);

        // Update stream for all existing and future connections
        webrtcRef.current.updateStream(stream);

        // Renegotiate with existing listeners
        webrtcRef.current.conns.forEach((pc, listenerId) => {
            webrtcRef.current.createOffer(listenerId, stream);
        });
    };

    const stopBroadcast = () => {
        setIsLive(false);
        setAudioSource(null);
        if (webrtcRef.current && webrtcRef.current.localStream) {
            webrtcRef.current.localStream.getTracks().forEach(track => track.stop());
            webrtcRef.current.updateStream(null);
        }
        if (mediaElementRef.current) {
            mediaElementRef.current.pause();
        }
    };

    const copyLink = () => {
        const link = `${window.location.origin}/party/${partyId}`;
        navigator.clipboard.writeText(link);
        alert('Invite link copied to clipboard!');
    };

    return (
        <div className="min-h-screen p-6 relative flex justify-center">
            {/* Dynamic Background based on live status */}
            <div className={`absolute top-0 left-0 w-full h-full pointer-events-none transition-colors duration-1000 ${isLive ? 'bg-purple-900/10' : 'bg-transparent'}`}></div>

            <div className="w-full max-w-2xl relative z-10 pt-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
                        ← Back
                    </button>
                    <div className="font-semibold text-xl tracking-wider text-purple-400">HOST Dashboard</div>
                </div>

                {/* Status Card */}
                <div className="glass-panel rounded-3xl p-8 mb-8 relative overflow-hidden text-center">
                    {isLive && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-red-400 font-bold text-sm tracking-widest animate-pulse">
                            <Activity size={16} /> LIVE
                        </div>
                    )}

                    <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center mb-6 transition-all duration-500 ${isLive ? 'bg-purple-500/20 shadow-[0_0_50px_rgba(168,85,247,0.4)] animate-pulse-ring' : 'bg-white/5'}`}>
                        <Radio size={48} className={isLive ? 'text-purple-400' : 'text-gray-500'} />
                    </div>

                    <h1 className="text-4xl font-bold mb-2">Live Session</h1>

                    {partyId ? (
                        <div className="flex items-center justify-center gap-4 mt-6">
                            <div className="bg-black/50 py-3 px-6 rounded-xl font-mono text-2xl tracking-widest border border-white/10 text-blue-400">
                                {partyId.toUpperCase()}
                            </div>
                            <button onClick={copyLink} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-colors tooltip" title="Copy Invite Link">
                                <Copy size={24} />
                            </button>
                        </div>
                    ) : (
                        <p className="text-gray-400 mt-6 animate-pulse">Creating party...</p>
                    )}

                    <div className="flex items-center justify-center gap-2 mt-8 text-gray-400 bg-white/5 inline-flex mx-auto px-6 py-2 rounded-full border border-white/5">
                        <Users size={18} />
                        <span className="font-medium">{listenersCount} Listeners Connected</span>
                    </div>
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {!isLive ? (
                        <>
                            <button
                                onClick={startMicBroadcast}
                                className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-white/10 transition-colors group cursor-pointer"
                            >
                                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Mic size={32} />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-semibold text-lg">Use Microphone</h3>
                                    <p className="text-sm text-gray-400">Broadcast your voice real-time</p>
                                </div>
                            </button>

                            <label className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-white/10 transition-colors group cursor-pointer">
                                <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                                <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                                    <Upload size={32} />
                                </div>
                                <div className="text-center">
                                    <h3 className="font-semibold text-lg">Broadcast Audio File</h3>
                                    <p className="text-sm text-gray-400">Play an MP3/WAV perfectly synced</p>
                                </div>
                            </label>
                        </>
                    ) : (
                        <button
                            onClick={stopBroadcast}
                            className="col-span-1 md:col-span-2 glass-panel p-6 rounded-2xl flex flex-col items-center justify-center gap-4 hover:bg-red-500/10 border-red-500/30 transition-colors group cursor-pointer"
                        >
                            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 group-hover:scale-110 transition-transform">
                                <StopCircle size={32} />
                            </div>
                            <div className="text-center">
                                <h3 className="font-semibold text-lg text-red-400">Stop Broadcasting</h3>
                                <p className="text-sm text-gray-400">End the current stream</p>
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
