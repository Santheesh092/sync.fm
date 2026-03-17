import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Headphones, ArrowRight, Play, Zap, Smartphone, Sliders, Music, Lock, Globe } from 'lucide-react';

const FEATURES = [
    { icon: <Zap size={22} />, title: 'Ultra Low Latency', desc: '<50ms sync across all devices', color: 'text-yellow-400' },
    { icon: <Smartphone size={22} />, title: 'Any Device', desc: 'Phone, TV, speaker — all synced', color: 'text-blue-400' },
    { icon: <Sliders size={22} />, title: 'Pro Equalizer', desc: '10-band EQ with smart presets', color: 'text-purple-400' },
    { icon: <Music size={22} />, title: 'DJ Mode', desc: 'Crossfader, decks, live FX', color: 'text-pink-400' },
    { icon: <Lock size={22} />, title: 'Secure & Private', desc: 'Encrypted, password-protected rooms', color: 'text-green-400' },
    { icon: <Globe size={22} />, title: '1000+ Devices', desc: 'Scale from party to stadium', color: 'text-cyan-400' },
];

const USE_CASES = [
    { emoji: '🎉', title: 'Party Mode', desc: 'Sync music across every room in the house' },
    { emoji: '☕', title: 'Café / Restaurant', desc: 'Scheduled ambient playlists, zone control' },
    { emoji: '🛕', title: 'Temple Broadcast', desc: 'Prayer & bhajan broadcasts to congregation' },
    { emoji: '📢', title: 'Public Announcement', desc: 'Live mic or pre-recorded announcements' },
    { emoji: '🎵', title: 'Event Sync', desc: 'Silent disco & festival audio experiences' },
    { emoji: '🚨', title: 'Public Safety', desc: 'Emergency alerts to all connected devices' },
];

function FloatingSpeaker({ style }) {
    return (
        <div className="absolute pointer-events-none opacity-10 animate-float" style={style}>
            <Radio size={28} color="#F2C21A" />
        </div>
    );
}

export default function Home() {
    const [joinCode, setJoinCode] = useState('');
    const navigate = useNavigate();

    const handleJoin = (e) => {
        e.preventDefault();
        if (joinCode.trim()) navigate(`/join/${joinCode.trim().toUpperCase()}`);
    };

    return (
        <div className="min-h-screen relative overflow-x-hidden">
            {/* Background radial glows */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #0B3553 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] rounded-full opacity-20"
                    style={{ background: 'radial-gradient(circle, #F2C21A22 0%, transparent 70%)' }} />
            </div>

            {/* Floating speakers */}
            {[
                { top: '10%', left: '5%', animationDelay: '0s' },
                { top: '25%', right: '8%', animationDelay: '0.6s' },
                { top: '60%', left: '3%', animationDelay: '1.2s' },
                { top: '70%', right: '5%', animationDelay: '1.8s' },
                { top: '45%', left: '12%', animationDelay: '0.4s' },
            ].map((s, i) => <FloatingSpeaker key={i} style={s} />)}

            {/* ── Nav ── */}
            <nav className="relative z-20 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(242,194,26,0.15)', border: '1px solid rgba(242,194,26,0.3)' }}>
                        <Radio size={18} color="#F2C21A" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">Nearby<span style={{ color: '#F2C21A' }}>.fm</span></span>
                </div>

                <div className="hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: '#6b8fa8' }}>
                    <button onClick={() => navigate('/')} className="hover:text-white transition-colors">Home</button>
                    <button onClick={() => navigate('/create-room')} className="hover:text-white transition-colors">Create Room</button>
                    <button onClick={() => navigate('/join-room')} className="hover:text-white transition-colors">Join Room</button>
                </div>

                <button onClick={() => navigate('/create-room')} className="btn-accent text-sm px-4 py-2">
                    Get Started →
                </button>
            </nav>

            {/* ── Hero ── */}
            <section className="relative z-10 max-w-4xl mx-auto px-6 pt-16 pb-24 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-medium"
                    style={{ background: 'rgba(242,194,26,0.1)', border: '1px solid rgba(242,194,26,0.25)', color: '#F2C21A' }}>
                    <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    Real-time Audio Sync Platform
                </div>

                <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight">
                    <span className="text-white">Global Audio</span>
                    <br />
                    <span style={{
                        background: 'linear-gradient(135deg, #F2C21A 0%, #fff8dc 50%, #F2C21A 100%)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                    }}>Sync Platform</span>
                </h1>

                <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#6b8fa8', lineHeight: 1.7 }}>
                    Play one audio track across <strong style={{ color: '#E8F4FD' }}>unlimited devices</strong> in perfect sync.
                    Party rooms, café playlists, temple broadcasts — all in &lt;50ms.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                    <button onClick={() => navigate('/create-room')}
                        className="btn-accent flex items-center gap-2 text-base px-8 py-4">
                        Create Audio Room <ArrowRight size={18} />
                    </button>
                    <button onClick={() => navigate('/join-room')}
                        className="btn-outline flex items-center gap-2 text-base px-8 py-4">
                        Join with QR Code <Headphones size={18} />
                    </button>
                </div>

                {/* Quick Join */}
                <form onSubmit={handleJoin}
                    className="flex gap-3 max-w-sm mx-auto glass-panel p-3 rounded-2xl">
                    <input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value)}
                        placeholder="Enter room code…"
                        className="input-field font-mono uppercase tracking-widest text-center text-sm py-2"
                    />
                    <button type="submit" disabled={!joinCode.trim()}
                        className="btn-accent px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap">
                        Join
                    </button>
                </form>
            </section>

            {/* ── Features Grid ── */}
            <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
                <h2 className="text-3xl font-bold text-center mb-3">Everything You Need</h2>
                <p className="text-center mb-12" style={{ color: '#6b8fa8' }}>Professional-grade audio sync tools for every use case</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {FEATURES.map((f, i) => (
                        <div key={i} className="glass-card p-6">
                            <div className={`mb-4 ${f.color}`}>{f.icon}</div>
                            <h3 className="font-bold text-base mb-1">{f.title}</h3>
                            <p className="text-sm" style={{ color: '#6b8fa8' }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Use Cases ── */}
            <section className="relative z-10 pb-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <h2 className="text-3xl font-bold text-center mb-3">Built for Every Venue</h2>
                    <p className="text-center mb-10" style={{ color: '#6b8fa8' }}>From living rooms to stadiums</p>

                    <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
                        {USE_CASES.map((c, i) => (
                            <div key={i} className="glass-card p-6 flex-shrink-0 w-52">
                                <div className="text-4xl mb-4">{c.emoji}</div>
                                <h3 className="font-bold mb-2">{c.title}</h3>
                                <p className="text-sm" style={{ color: '#6b8fa8' }}>{c.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative z-10 pb-20 px-6">
                <div className="max-w-2xl mx-auto glass-panel rounded-3xl p-12 text-center"
                    style={{ border: '1px solid rgba(242,194,26,0.2)' }}>
                    <Radio size={40} color="#F2C21A" className="mx-auto mb-6" />
                    <h2 className="text-3xl font-bold mb-4">Ready to Sync?</h2>
                    <p className="mb-8" style={{ color: '#6b8fa8' }}>Create your first room in seconds. No account required.</p>
                    <button onClick={() => navigate('/create-room')}
                        className="btn-accent text-base px-10 py-4">
                        Launch Your Room →
                    </button>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="relative z-10 border-t text-center py-8 px-6"
                style={{ borderColor: 'rgba(242,194,26,0.1)', color: '#6b8fa8' }}>
                <div className="flex items-center justify-center gap-2 mb-3">
                    <Radio size={16} color="#F2C21A" />
                    <span className="font-bold text-white">Nearby<span style={{ color: '#F2C21A' }}>.fm</span></span>
                </div>
                <p className="text-sm">© 2026 Nearby.fm — Global Audio Sync Platform</p>
            </footer>
        </div>
    );
}
