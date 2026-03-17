import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Radio, Camera, Link, Wifi, RefreshCw } from 'lucide-react';

const SERVER_URL = 'http://localhost:3001';

export default function JoinRoom() {
    const navigate = useNavigate();
    const [tab, setTab] = useState('link');
    const [roomCode, setRoomCode] = useState('');
    const [nearbyRooms, setNearbyRooms] = useState([]);
    const [loadingNearby, setLoadingNearby] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [scanning, setScanning] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);

    // Fetch nearby rooms
    const fetchNearby = async () => {
        setLoadingNearby(true);
        try {
            const res = await fetch('/api/rooms/nearby');
            const data = await res.json();
            setNearbyRooms(Array.isArray(data) ? data : []);
        } catch {
            setNearbyRooms([]);
        } finally {
            setLoadingNearby(false);
        }
    };

    useEffect(() => {
        if (tab === 'nearby') {
            fetchNearby();
            const iv = setInterval(fetchNearby, 3000);
            return () => clearInterval(iv);
        }
        if (tab === 'qr') {
            startCamera();
        } else {
            stopCamera();
        }
    }, [tab]);

    const startCamera = async () => {
        setCameraError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setScanning(true);
                requestAnimationFrame(scanFrame);
            }
        } catch (err) {
            setCameraError('Camera access denied. Please allow camera or paste a link instead.');
        }
    };

    const stopCamera = () => {
        setScanning(false);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    const scanFrame = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(scanFrame);
            return;
        }
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);

        // Try to decode QR using jsQR if available
        if (window.jsQR) {
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = window.jsQR(imgData.data, imgData.width, imgData.height);
            if (code && code.data) {
                handleQRCode(code.data);
                return;
            }
        }
        rafRef.current = requestAnimationFrame(scanFrame);
    };

    const handleQRCode = (codeData) => {
        stopCamera();
        // Extract room ID from URL or direct code
        const match = codeData.match(/\/join\/([A-Z0-9]+)/i) || codeData.match(/\/party\/([A-Z0-9]+)/i);
        if (match) {
            navigate(`/join/${match[1].toUpperCase()}`);
        } else if (/^[A-Z0-9]{4,8}$/i.test(codeData.trim())) {
            navigate(`/join/${codeData.trim().toUpperCase()}`);
        } else {
            // Try as URL
            try {
                const url = new URL(codeData);
                window.location.href = codeData;
            } catch {
                alert(`Unrecognized QR code: ${codeData}`);
            }
        }
    };

    const handleJoinByCode = (e) => {
        e.preventDefault();
        if (roomCode.trim()) navigate(`/join/${roomCode.trim().toUpperCase()}`);
    };

    const ROOM_TYPE_EMOJI = { party: '🎉', cafe: '☕', temple: '🛕', announcement: '📢', event: '🎵', safety: '🚨' };

    return (
        <div className="min-h-screen relative">
            {/* BG */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-64 opacity-15"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, #F2C21A20, transparent)' }} />
            </div>

            {/* Nav */}
            <nav className="relative z-20 flex items-center gap-4 px-6 py-5">
                <button
                    onClick={() => navigate('/')}
                    className="p-0 flex items-center gap-1.5 text-sm bg-transparent border-none shadow-none hover:bg-transparent focus:outline-none"
                >
                    <ArrowLeft size={14} />
                </button>
                <div className="flex items-center gap-2">
                    <Radio size={18} color="#F2C21A" />
                    <span className="font-bold">Nearby<span style={{ color: '#F2C21A' }}>.fm</span></span>
                </div>
            </nav>

            <div className="relative z-10 max-w-lg mx-auto px-6 pb-20">
                <h1 className="text-3xl font-bold mb-2 mt-4">Join a Room</h1>
                <p className="mb-8" style={{ color: '#6b8fa8' }}>Choose how you want to connect</p>

                {/* Tab Bar */}
                <div className="tab-bar mb-6">
                    <button onClick={() => setTab('qr')} className={`tab-btn flex items-center justify-center gap-1.5 ${tab === 'qr' ? 'active' : ''}`}>
                        <Camera size={14} /> Scan QR
                    </button>
                    <button onClick={() => setTab('link')} className={`tab-btn flex items-center justify-center gap-1.5 ${tab === 'link' ? 'active' : ''}`}>
                        <Link size={14} /> Paste Link
                    </button>
                    <button onClick={() => setTab('nearby')} className={`tab-btn flex items-center justify-center gap-1.5 ${tab === 'nearby' ? 'active' : ''}`}>
                        <Wifi size={14} /> Nearby
                    </button>
                </div>

                {/* ── Tab: QR Scanner ── */}
                {tab === 'qr' && (
                    <div className="animate-slide-up">
                        <div className="glass-panel rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
                            {cameraError ? (
                                <div className="p-8 text-center">
                                    <Camera size={40} className="mx-auto mb-4 opacity-40" />
                                    <p className="text-sm mb-4" style={{ color: '#6b8fa8' }}>{cameraError}</p>
                                    <button onClick={startCamera} className="btn-outline text-sm px-6 py-2">Try Again</button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <video ref={videoRef} className="w-full rounded-2xl" playsInline muted />
                                    <canvas ref={canvasRef} className="hidden" />
                                    {scanning && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-48 h-48 border-2 border-yellow-400 rounded-2xl animate-pulse opacity-70"
                                                style={{ boxShadow: '0 0 20px rgba(242,194,26,0.3)' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <p className="text-center text-sm mt-4" style={{ color: '#6b8fa8' }}>
                            Point camera at a Nearby.fm QR code
                        </p>
                        {/* jsQR CDN script */}
                        <script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js" async />
                    </div>
                )}

                {/* ── Tab: Paste Link ── */}
                {tab === 'link' && (
                    <div className="animate-slide-up glass-panel rounded-2xl p-8">
                        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                            <Link size={18} color="#F2C21A" /> Enter Room Code or Link
                        </h2>
                        <form onSubmit={handleJoinByCode} className="space-y-4">
                            <input
                                className="input-field font-mono uppercase tracking-widest text-center text-xl py-4"
                                placeholder="ABCD12"
                                value={roomCode}
                                onChange={e => setRoomCode(e.target.value.toUpperCase().slice(0, 8))}
                                maxLength={8}
                                autoFocus
                            />
                            <p className="text-xs text-center" style={{ color: '#6b8fa8' }}>
                                or paste the full invite link
                            </p>
                            <input
                                className="input-field text-sm py-3"
                                placeholder="https://nearby.fm/join/ABCD12"
                                onChange={e => {
                                    const match = e.target.value.match(/\/join\/([A-Z0-9]+)/i) || e.target.value.match(/\/party\/([A-Z0-9]+)/i);
                                    if (match) setRoomCode(match[1].toUpperCase());
                                }}
                            />
                            <button type="submit" disabled={!roomCode.trim()}
                                className="btn-accent w-full py-4 flex items-center justify-center gap-2 text-base disabled:opacity-40">
                                <Radio size={18} /> Join Room
                            </button>
                        </form>
                    </div>
                )}

                {/* ── Tab: Nearby Rooms ── */}
                {tab === 'nearby' && (
                    <div className="animate-slide-up">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold">Available Rooms on Network</h2>
                            <button onClick={fetchNearby} disabled={loadingNearby}
                                className="btn-ghost px-3 py-2 text-sm flex items-center gap-1.5">
                                <RefreshCw size={14} className={loadingNearby ? 'animate-spin' : ''} /> Refresh
                            </button>
                        </div>

                        {loadingNearby && nearbyRooms.length === 0 ? (
                            <div className="glass-panel rounded-2xl p-12 text-center">
                                <div className="w-8 h-8 border-2 border-yellow-400/30 border-t-yellow-400 rounded-full animate-spin mx-auto mb-4" />
                                <p style={{ color: '#6b8fa8' }}>Scanning for rooms…</p>
                            </div>
                        ) : nearbyRooms.length === 0 ? (
                            <div className="glass-panel rounded-2xl p-12 text-center">
                                <Wifi size={40} className="mx-auto mb-4 opacity-30" />
                                <h3 className="font-semibold mb-2">No rooms found</h3>
                                <p className="text-sm" style={{ color: '#6b8fa8' }}>
                                    Rooms refresh every 3 seconds. Ask the host to create a public room.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {nearbyRooms.map(room => (
                                    <button key={room.id} onClick={() => navigate(`/join/${room.id}`)}
                                        className="glass-card w-full text-left p-4 flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{ROOM_TYPE_EMOJI[room.type] || '🎵'}</span>
                                            <div>
                                                <div className="font-semibold">{room.name}</div>
                                                <div className="text-xs mt-0.5 font-mono" style={{ color: '#6b8fa8' }}>
                                                    Code: {room.id} · {room.deviceCount} connected
                                                </div>
                                            </div>
                                        </div>
                                        <ArrowLeft size={16} className="rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#F2C21A' }} />
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-center mt-4" style={{ color: '#6b8fa8' }}>Auto-refreshes every 3 seconds</p>
                    </div>
                )}
            </div>
        </div>
    );
}
