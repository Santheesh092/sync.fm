import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Radio, ArrowLeft, ArrowRight, Copy, Download, Settings, Lock, Users, Volume2 } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

const SERVER_URL = '';

const ROOM_TYPES = [
    { id: 'party', emoji: '🎉', label: 'Party Mode', path: 'party', desc: 'Music sync for gatherings' },
    // { id: 'cafe', emoji: '☕', label: 'Café / Restaurant', path: 'cafe', desc: 'Ambient scheduled playlists' },
    // { id: 'temple', emoji: '🛕', label: 'Temple Broadcast', path: 'temple', desc: 'Prayer & bhajan streaming' },
    // { id: 'announcement', emoji: '📢', label: 'Public Announcement', path: 'announcement', desc: 'Live mic broadcasting' },
    // { id: 'event', emoji: '🎵', label: 'Event Sync', path: 'event', desc: 'Festival / silent disco' },
    // { id: 'safety', emoji: '🚨', label: 'Public Safety', path: 'safety', desc: 'Emergency alert broadcasts' },
    { id: 'dj', emoji: '🎧', label: 'DJ Mode', path: 'dj', desc: 'Professional DJ console & mixer' },
];

const QUALITY_OPTIONS = [
    { id: 'low', label: 'Low', desc: '64 kbps' },
    { id: 'medium', label: 'Medium', desc: '128 kbps' },
    { id: 'high', label: 'High', desc: '256 kbps' },
    { id: 'lossless', label: 'Lossless', desc: 'FLAC' },
];

export default function CreateRoom() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1=configure, 2=launched
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
        if (!roomName.trim()) {
            alert('Please enter a room name');
            return;
        }
        setLoading(true);
        try {
            // Optional health check
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
            setStep(2);
        } catch (err) {
            console.error('[CreateRoom] Error:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setLoading(false); // Duplicate handleLaunch removed – file upload logic moved elsewhere
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
                    onClick={() => {
                        if (step > 1) setStep(step - 1);
                        else navigate('/');
                    }}
                    className="p-0 flex items-center gap-1.5 text-sm bg-transparent border-none shadow-none hover:bg-transparent focus:outline-none"
                >
                    <ArrowLeft size={14} />
                </button>
                <div className="flex items-center gap-2">
                    <Radio size={18} color="#F2C21A" />
                    <span className="font-bold">Vibez<span style={{ color: '#F2C21A' }}>.fm</span></span>
                </div>
            </nav>

            <div className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
                {/* Progress */}
                <div className="flex items-center gap-3 mb-10 mt-4">
                    {[1, 2].map(s => (
                        <div key={s} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                ${step >= s ? 'text-black' : 'text-gray-500 bg-white/5 border border-white/10'}`}
                                style={step >= s ? { background: '#F2C21A' } : {}}>
                                {s}
                            </div>
                            {s < 2 && <div className={`h-px w-16 transition-all ${step > s ? 'bg-yellow-400' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                    <span className="ml-2 text-sm" style={{ color: '#6b8fa8' }}>
                        {step === 1 ? 'Configure Your Room' : 'Room Launched!'}
                    </span>
                </div>

                {/* ── Step 1: Settings ── */}
                {step === 1 && (
                    <div className="animate-slide-up">
                        <h1 className="text-3xl font-bold mb-2">Configure Room</h1>
                        <p className="mb-8" style={{ color: '#6b8fa8' }}>Set up your live audio space</p>

                        <div className="glass-panel rounded-2xl p-6 space-y-6 mb-6">
                            {/* Room Type Dropdown */}
                            <div>
                                <label className="block text-sm font-semibold mb-2">Room Type</label>
                                <select
                                    className="input-field appearance-none"
                                    value={roomType}
                                    onChange={e => setRoomType(e.target.value)}
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23F2C21A'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'right 16px center',
                                        backgroundSize: '16px'
                                    }}
                                >
                                    {ROOM_TYPES.map(t => (
                                        <option key={t.id} value={t.id} style={{ background: '#0B1F33' }}>
                                            {t.emoji} {t.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[10px] mt-1.5 opacity-60 ml-1">{selectedType?.desc}</p>
                            </div>

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

                            {/* Advanced Settings Container */}
                            <div className="p-5 rounded-2xl bg-[#0B1F33]/50 border border-white/5 space-y-6">
                                {/* Listener Controls Toggle */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                                            <Users size={18} color="#F2C21A" />
                                        </div>
                                        <div>
                                            <div className="font-semibold text-sm text-white">Allow Listener Controls</div>
                                            <div className="text-xs mt-0.5" style={{ color: '#6b8fa8' }}>Listeners can pause/seek</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setAllowControls(v => !v)}
                                        className={`w-14 h-7 rounded-full transition-all duration-300 relative ${allowControls ? 'bg-[#F2C21A] shadow-[0_0_15px_rgba(242,194,26,0.4)]' : 'bg-white/10'}`}>
                                        <div className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-all duration-300 shadow-md ${allowControls ? 'left-8' : 'left-1'}`} />
                                    </button>
                                </div>

                                {/* Audio Quality */}
                                <div>
                                    <label className="block text-sm font-semibold mb-3 flex items-center gap-2 text-white">
                                        <Volume2 size={16} color="#F2C21A" /> Audio Quality
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {QUALITY_OPTIONS.map(q => (
                                            <button key={q.id} onClick={() => setQuality(q.id)}
                                                className={`relative overflow-hidden py-3 px-2 rounded-xl text-xs font-bold border transition-all duration-300 text-center group
                                    ${quality === q.id
                                                        ? 'border-[#F2C21A] bg-[#F2C21A]/10 text-[#F2C21A] shadow-[0_0_15px_rgba(242,194,26,0.2)]'
                                                        : 'border-white/5 bg-white/5 text-gray-400 hover:border-white/20 hover:bg-white/10'}`}>

                                                {/* Active indicator glow */}
                                                {quality === q.id && (
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#F2C21A]/20 to-transparent opacity-50" />
                                                )}

                                                <div className="relative z-10">
                                                    {q.label}
                                                    <div className={`font-normal mt-1 transition-colors ${quality === q.id ? 'text-[#F2C21A]/80' : 'opacity-50'}`}>{q.desc}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => navigate('/')} className="btn-ghost px-6 py-4">Cancel</button>
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

                {/* ── Step 2: Launched ── */}
                {step === 2 && roomId && (
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
                                Join my {selectedType?.label} on Vibez.fm! 🎵<br />
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
