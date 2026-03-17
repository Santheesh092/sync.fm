import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Radio, ArrowLeft, ArrowRight, Copy, Download, Settings, Lock, Users, Volume2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const SERVER_URL = 'http://localhost:3001';

const ROOM_TYPES = [
    { id: 'party', emoji: '🎉', label: 'Party Mode', path: 'party', desc: 'Music sync for gatherings' },
    { id: 'cafe', emoji: '☕', label: 'Café / Restaurant', path: 'cafe', desc: 'Ambient scheduled playlists' },
    { id: 'temple', emoji: '🛕', label: 'Temple Broadcast', path: 'temple', desc: 'Prayer & bhajan streaming' },
    { id: 'announcement', emoji: '📢', label: 'Public Announcement', path: 'announcement', desc: 'Live mic broadcasting' },
    { id: 'event', emoji: '🎵', label: 'Event Sync', path: 'event', desc: 'Festival / silent disco' },
    { id: 'safety', emoji: '🚨', label: 'Public Safety', path: 'safety', desc: 'Emergency alert broadcasts' },
];

const QUALITY_OPTIONS = [
    { id: 'low', label: 'Low', desc: '64 kbps' },
    { id: 'medium', label: 'Medium', desc: '128 kbps' },
    { id: 'high', label: 'High', desc: '256 kbps' },
    { id: 'lossless', label: 'Lossless', desc: 'FLAC' },
];

export default function CreateRoom() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1=type, 2=settings, 3=launched
    const [roomType, setRoomType] = useState('party');
    const [roomName, setRoomName] = useState('');
    const [maxDevices, setMaxDevices] = useState(0);
    const [password, setPassword] = useState('');
    const [allowControls, setAllowControls] = useState(false);
    const [quality, setQuality] = useState('high');
    const [roomId, setRoomId] = useState(null);
    const [shareUrl, setShareUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    const selectedType = ROOM_TYPES.find(t => t.id === roomType);

    const handleLaunch = async () => {
        if (!roomName.trim()) return alert('Please enter a room name');
        setLoading(true);
        try {
            // Pre-flight health check
            try {
                const healthRes = await fetch('/api/health');
                if (!healthRes.ok) console.warn('Backend health check failed, proceeding anyway...');
            } catch (e) {
                console.warn('Backend reachability check failed:', e.message);
            }

            const res = await fetch('/api/room', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: roomType,
                    name: roomName.trim(),
                    password: password || null,
                    allowListenerControls: allowControls,
                    quality,
                    maxDevices: maxDevices > 0 ? maxDevices : null,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                const errorMsg = data.error || data.details || 'Failed to create room';
                throw new Error(errorMsg + (data.stack ? `\n\n${data.stack}` : ''));
            }

            const url = `${window.location.origin}/join/${data.roomId}`;
            setRoomId(data.roomId);
            setShareUrl(url);
            setStep(3);
        } catch (err) {
            console.error('[CreateRoom] Error:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleGoToRoom = () => {
        navigate(`/room/${roomId}`);
    };

    return (
        <div className="min-h-screen relative">
            {/* BG */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-64 opacity-20"
                    style={{ background: 'radial-gradient(ellipse at 50% 0%, #0B3553, transparent)' }} />
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

            <div className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-10 mt-4">
                    {[1, 2, 3].map(s => (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${step >= s ? 'text-black' : 'text-gray-500 bg-white/5 border border-white/10'}`}
                                style={step >= s ? { background: '#F2C21A' } : {}}>
                                {s}
                            </div>
                            {s < 3 && <div className={`h-px w-16 transition-all ${step > s ? 'bg-yellow-400' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                    <span className="ml-2 text-sm" style={{ color: '#6b8fa8' }}>
                        {step === 1 ? 'Choose Room Type' : step === 2 ? 'Configure Settings' : 'Room Launched!'}
                    </span>
                </div>

                {/* ── Step 1: Room Type ── */}
                {step === 1 && (
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold mb-2">Choose Room Type</h1>
                        <p className="mb-8" style={{ color: '#6b8fa8' }}>Select the mode that fits your event</p>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                            {ROOM_TYPES.map(t => (
                                <button key={t.id} onClick={() => setRoomType(t.id)}
                                    className={`room-type-card ${roomType === t.id ? 'selected' : ''}`}>
                                    <div className="text-4xl mb-3">{t.emoji}</div>
                                    <div className="font-bold text-sm mb-1">{t.label}</div>
                                    <div className="text-xs" style={{ color: '#6b8fa8' }}>{t.desc}</div>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => setStep(2)} className="btn-accent w-full py-4 flex items-center justify-center gap-2">
                            Continue <ArrowRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── Step 2: Settings ── */}
                {step === 2 && (
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold mb-2">{selectedType?.emoji} {selectedType?.label}</h1>
                        <p className="mb-8" style={{ color: '#6b8fa8' }}>Configure your room settings</p>

                        <div className="glass-panel rounded-2xl p-6 space-y-6 mb-6">
                            {/* Room Name */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Room Name</label>
                                <input
                                    className="input-field"
                                    placeholder={`e.g. Saturday Night ${selectedType?.label}`}
                                    value={roomName}
                                    onChange={e => setRoomName(e.target.value)}
                                />
                            </div>

                            {/* Max Devices */}
                            <div>
                                <div className="flex justify-between text-sm mb-2">
                                    <label className="font-semibold">Max Devices</label>
                                    <span style={{ color: '#F2C21A' }} className="font-bold font-mono">{maxDevices}</span>
                                </div>
                                <input type="range" min="0" max="1000" step="1"
                                    value={maxDevices} onChange={e => setMaxDevices(Number(e.target.value))}
                                    className="w-full h-1"
                                    style={{
                                        background: `linear-gradient(to right, #F2C21A 0%, #F2C21A ${maxDevices / 10}%, rgba(255,255,255,0.1) ${maxDevices / 10}%, rgba(255,255,255,0.1) 100%)`
                                    }} />
                                <div className="flex justify-between text-xs mt-1" style={{ color: '#6b8fa8' }}>
                                    <span>0</span><span>1000</span>
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="block text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Lock size={14} /> Room Password <span className="font-normal" style={{ color: '#6b8fa8' }}>(optional)</span>
                                </label>
                                <input
                                    type="password"
                                    className="input-field"
                                    placeholder="Leave empty for public room"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>

                            {/* Listener Controls Toggle */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-sm">Allow Listener Controls</div>
                                    <div className="text-xs mt-0.5" style={{ color: '#6b8fa8' }}>Listeners can pause/seek</div>
                                </div>
                                <button onClick={() => setAllowControls(v => !v)}
                                    className={`w-12 h-6 rounded-full transition-all relative ${allowControls ? 'bg-yellow-400' : 'bg-white/10'}`}>
                                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all ${allowControls ? 'left-6' : 'left-0.5'}`} />
                                </button>
                            </div>

                            {/* Audio Quality */}
                            <div>
                                <label className="block text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Volume2 size={14} /> Audio Quality
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {QUALITY_OPTIONS.map(q => (
                                        <button key={q.id} onClick={() => setQuality(q.id)}
                                            className={`py-3 px-2 rounded-xl text-xs font-bold border transition-all text-center
                        ${quality === q.id
                                                    ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                                                    : 'border-white/10 bg-white/5 text-gray-400 hover:border-white/20'}`}>
                                            {q.label}
                                            <div className="font-normal mt-0.5 opacity-70">{q.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep(1)} className="btn-ghost px-6 py-4">← Back</button>
                            <button onClick={handleLaunch} disabled={loading || !roomName.trim()}
                                className="btn-accent flex-1 py-4 flex items-center justify-center gap-2 disabled:opacity-50">
                                {loading ? (
                                    <><span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Creating…</>
                                ) : (
                                    <><Radio size={18} /> Launch Room</>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Step 3: Launched ── */}
                {step === 3 && roomId && (
                    <div className="animate-slide-up text-center">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 animate-glow"
                            style={{ background: 'rgba(242,194,26,0.15)', border: '2px solid rgba(242,194,26,0.5)' }}>
                            <Radio size={28} color="#F2C21A" />
                        </div>
                        <h1 className="text-3xl font-bold mb-2">Room is Live!</h1>
                        <p className="mb-8" style={{ color: '#6b8fa8' }}>Share the link or QR code to invite listeners</p>

                        {/* QR Code */}
                        <div className="glass-panel rounded-2xl p-8 mb-6 inline-block">
                            <QRCodeCanvas
                                value={shareUrl}
                                size={200}
                                fgColor="#0B3553"
                                bgColor="#F2C21A"
                                level="H"
                            />
                            <div className="mt-4 font-mono text-2xl font-bold tracking-widest" style={{ color: '#F2C21A' }}>
                                {roomId}
                            </div>
                            <div className="text-sm mt-1" style={{ color: '#6b8fa8' }}>{selectedType?.emoji} {selectedType?.label}</div>
                        </div>

                        {/* Share Link */}
                        <div className="glass-panel rounded-xl p-3 flex items-center gap-3 mb-6 max-w-sm mx-auto">
                            <span className="text-xs flex-1 text-left truncate font-mono" style={{ color: '#E8F4FD' }}>
                                {shareUrl}
                            </span>
                            <button onClick={handleCopy}
                                className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-all
                  ${copied ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'btn-ghost'}`}>
                                {copied ? '✓ Copied' : <><Copy size={14} className="inline mr-1" />Copy</>}
                            </button>
                        </div>

                        {/* Invite message */}
                        <div className="glass-card p-4 text-left mb-6 max-w-sm mx-auto">
                            <div className="text-xs font-semibold mb-2" style={{ color: '#6b8fa8' }}>📋 Invite Message</div>
                            <p className="text-sm" style={{ color: '#E8F4FD' }}>
                                Join my {selectedType?.label} on Nearby.fm! 🎵<br />
                                Room code: <strong style={{ color: '#F2C21A' }}>{roomId}</strong><br />
                                Or visit: {shareUrl}
                            </p>
                        </div>

                        <button onClick={handleGoToRoom}
                            className="btn-accent text-base px-10 py-4 flex items-center gap-2 mx-auto">
                            <Radio size={18} /> Go to Room Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
