import React, { useState, useEffect, useMemo } from 'react';
import { Users, Activity, Zap, X, BarChart3, HeartPulse, Wifi } from 'lucide-react';

export default function AnalyticsDashboard({ devices, onClose }) {
    const [mounted, setMounted] = useState(false);
    
    useEffect(() => {
        setMounted(true);
    }, []);

    // Derived Metrics
    const listenerCount = devices.length;
    const baseAvgLatency = devices.length > 0 
        ? Math.round(devices.reduce((acc, d) => acc + (d.latency || 0), 0) / devices.length) 
        : 0;
    
    const baseHealthScore = useMemo(() => {
        if (devices.length === 0) return 100;
        const poorConnections = devices.filter(d => d.latency > 150).length;
        return Math.max(0, 100 - (poorConnections / devices.length) * 100);
    }, [devices]);

    // Dynamic Display States for Live Feel
    const [displayLatency, setDisplayLatency] = useState(baseAvgLatency);
    const [displayHealth, setDisplayHealth] = useState(baseHealthScore);
    const [peakEngagement, setPeakEngagement] = useState(94);

    useEffect(() => {
        const interval = setInterval(() => {
            if (devices.length > 0) {
                // Jitter +/- 4ms
                setDisplayLatency(Math.max(0, baseAvgLatency + Math.floor(Math.random() * 9) - 4));
                // Jitter +/- 2%
                setDisplayHealth(Math.min(100, Math.max(0, baseHealthScore + Math.floor(Math.random() * 5) - 2)));
            } else {
                setDisplayLatency(0);
                setDisplayHealth(100);
            }
            // Jitter engagement
            setPeakEngagement(prev => Math.min(100, Math.max(80, prev + Math.floor(Math.random() * 5) - 2)));
        }, 1500);
        return () => clearInterval(interval);
    }, [baseAvgLatency, baseHealthScore, devices.length]);

    // Simulated Time Series Data for Latency Graph
    const [latencyData, setLatencyData] = useState(Array(20).fill(0).map(() => Math.random() * 50 + 20));
    
    useEffect(() => {
        const interval = setInterval(() => {
            setLatencyData(prev => {
                const newData = [...prev.slice(1)];
                const newLatency = baseAvgLatency + (Math.random() * 20 - 10);
                newData.push(Math.max(0, newLatency));
                return newData;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [baseAvgLatency]);

    // Render Sparkline
    const renderSparkline = (data, color, height = 60) => {
        const max = Math.max(...data, 100);
        const points = data.map((val, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 100 - (val / max) * 100;
            return `${x},${y}`;
        }).join(' ');

        return (
            <div className="relative w-full h-full flex items-end">
                <svg className="w-full h-full absolute inset-0 preserve-3d" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.5" />
                            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${points} 100,100`} fill={`url(#grad-${color})`} />
                    <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
        );
    };



    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 transition-all duration-500 ${mounted ? 'opacity-100' : 'opacity-0'}`}
             style={{ background: 'rgba(5, 14, 26, 0.8)', backdropFilter: 'blur(20px)' }}>
            
            <div className="relative w-full max-w-6xl max-h-full flex flex-col rounded-3xl overflow-hidden shadow-2xl border"
                 style={{ 
                     background: 'linear-gradient(145deg, rgba(15,30,50,0.9) 0%, rgba(5,14,26,0.95) 100%)',
                     borderColor: 'rgba(242,194,26,0.2)',
                     boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7), 0 0 40px rgba(242,194,26,0.1)'
                 }}>
                
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                             style={{ background: 'rgba(242,194,26,0.1)', border: '1px solid rgba(242,194,26,0.3)' }}>
                            <BarChart3 size={24} color="#F2C21A" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">Advanced Analytics</h2>
                            <p className="text-sm font-medium tracking-widest uppercase" style={{ color: '#6b8fa8' }}>Host Dashboard Overview</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    
                    {/* Top Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                        <StatCard 
                            icon={<Users size={20} color="#00CFFF" />}
                            label="Live Listeners" 
                            value={listenerCount} 
                            subtext="Active right now"
                            color="#00CFFF"
                        />
                        <StatCard 
                            icon={<HeartPulse size={20} color={displayHealth > 80 ? "#22C55E" : "#EAB308"} />}
                            label="Health Score" 
                            value={`${Math.round(displayHealth)}%`} 
                            subtext={displayHealth > 80 ? "Optimal Network" : "Degraded Performance"}
                            color={displayHealth > 80 ? "#22C55E" : "#EAB308"}
                        />
                        <StatCard 
                            icon={<Wifi size={20} color="#F2C21A" />}
                            label="Avg Latency" 
                            value={`${displayLatency}ms`} 
                            subtext="Across all devices"
                            color="#F2C21A"
                        />
                        <StatCard 
                            icon={<Zap size={20} color="#FF4444" />}
                            label="Peak Engagement" 
                            value={`${peakEngagement}%`} 
                            subtext="Last 30 minutes"
                            color="#FF4444"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        {/* Live Sync Latency Graph */}
                        <div className="lg:col-span-2 rounded-2xl p-6 border flex flex-col"
                             style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Activity size={18} color="#00CFFF" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sync Latency Tracker</h3>
                                </div>
                                <div className="text-xs font-mono px-3 py-1 rounded-full" style={{ background: 'rgba(0, 207, 255, 0.1)', color: '#00CFFF' }}>
                                    Live Updates
                                </div>
                            </div>
                            <div className="flex-1 min-h-[200px] relative">
                                {renderSparkline(latencyData, '#00CFFF')}
                                {/* Overlay Grids */}
                                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="w-full h-px bg-white" />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Device Health Status */}
                        <div className="rounded-2xl p-6 border flex flex-col"
                             style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-3 mb-6">
                                <Activity size={18} color="#F2C21A" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Device Health Status</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                {devices.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm">
                                        <Users size={32} className="mb-2 opacity-50" />
                                        No active listeners
                                    </div>
                                ) : (
                                    devices.map(d => {
                                        const isGood = d.latency < 100;
                                        const isFair = d.latency >= 100 && d.latency < 200;
                                        const color = isGood ? '#22C55E' : isFair ? '#F2C21A' : '#FF4444';
                                        
                                        return (
                                            <div key={d.id} className="flex items-center justify-between p-3 rounded-xl border"
                                                 style={{ background: 'rgba(0,0,0,0.2)', borderColor: 'rgba(255,255,255,0.05)' }}>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                                                    <div className="text-xs font-semibold text-gray-200">{d.name}</div>
                                                </div>
                                                <div className="text-xs font-mono font-bold" style={{ color }}>{d.latency}ms</div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>


                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, subtext, color }) {
    return (
        <div className="rounded-2xl p-6 border relative overflow-hidden group"
             style={{ background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }}>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity"
                 style={{ background: color }} />
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                     style={{ background: `rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.1)`, 
                              border: `1px solid rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.3)` }}>
                    {icon}
                </div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{label}</h4>
            </div>
            <div className="text-3xl font-black text-white mb-1" style={{ textShadow: `0 0 20px ${color}40` }}>{value}</div>
            <div className="text-xs font-semibold" style={{ color }}>{subtext}</div>
        </div>
    );
}
