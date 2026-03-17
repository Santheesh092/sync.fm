import { useState } from 'react';
import { Smartphone, Monitor, Tv, Speaker, Volume2, VolumeX, X, ChevronDown } from 'lucide-react';

const DEVICE_ICONS = {
    mobile: <Smartphone size={16} />,
    desktop: <Monitor size={16} />,
    tv: <Tv size={16} />,
    speaker: <Speaker size={16} />,
    host: <Monitor size={16} color="#F2C21A" />,
};

function LatencyDot({ ms }) {
    if (ms === 0) return <span className="latency-dot latency-green" title="<20ms" />;
    if (ms < 20) return <span className="latency-dot latency-green" title={`${ms}ms`} />;
    if (ms < 50) return <span className="latency-dot latency-yellow" title={`${ms}ms`} />;
    return <span className="latency-dot latency-red" title={`${ms}ms`} />;
}

const ZONES = ['A', 'B', 'C'];

export default function DevicePanel({ devices = [], onVolumeChange, onMute, onKick }) {
    const [expandedDevice, setExpandedDevice] = useState(null);

    const grouped = ZONES.reduce((acc, z) => {
        acc[z] = devices.filter(d => (d.zone || 'A') === z && !d.isHost);
        return acc;
    }, {});
    const hosts = devices.filter(d => d.isHost);

    const totalListeners = devices.filter(d => !d.isHost).length;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Connected Devices</h3>
                <div className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: 'rgba(242,194,26,0.15)', border: '1px solid rgba(242,194,26,0.3)', color: '#F2C21A' }}>
                    {totalListeners} Listeners
                </div>
            </div>

            {/* Host */}
            {hosts.map(d => (
                <div key={d.id} className="device-card mb-2" style={{ borderColor: 'rgba(242,194,26,0.2)' }}>
                    <span>{DEVICE_ICONS['host']}</span>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: '#F2C21A' }}>{d.name} (Host)</div>
                    </div>
                    <span className="zone-badge zone-a">HOST</span>
                </div>
            ))}

            {/* Zones */}
            <div className="flex-1 overflow-y-auto space-y-4">
                {ZONES.map(zone => grouped[zone].length > 0 && (
                    <div key={zone}>
                        <div className="text-xs font-bold mb-2 flex items-center gap-2" style={{ color: '#6b8fa8' }}>
                            <span className={`zone-badge zone-${zone.toLowerCase()}`}>Zone {zone}</span>
                            <span>{grouped[zone].length} device{grouped[zone].length !== 1 ? 's' : ''}</span>
                        </div>

                        {grouped[zone].map(d => (
                            <div key={d.id} className="mb-2">
                                <div className="device-card cursor-pointer"
                                    onClick={() => setExpandedDevice(expandedDevice === d.id ? null : d.id)}>
                                    <LatencyDot ms={d.latency || 0} />
                                    <span className="flex-shrink-0" style={{ color: '#6b8fa8' }}>
                                        {DEVICE_ICONS[d.type || 'mobile']}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">{d.name}</div>
                                        <div className="text-xs font-mono" style={{ color: '#6b8fa8' }}>
                                            {d.latency ? `${d.latency}ms` : 'measuring…'}
                                        </div>
                                    </div>
                                    <ChevronDown size={14} className={`flex-shrink-0 opacity-50 transition-transform ${expandedDevice === d.id ? 'rotate-180' : ''}`} />
                                </div>

                                {/* Expanded controls */}
                                {expandedDevice === d.id && (
                                    <div className="mt-1 p-3 rounded-b-xl space-y-2"
                                        style={{ background: 'rgba(5,14,26,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderTop: 'none' }}>
                                        {/* Volume */}
                                        <div className="flex items-center gap-2">
                                            <Volume2 size={12} style={{ color: '#6b8fa8' }} />
                                            <input type="range" min="0" max="1" step="0.01"
                                                defaultValue={d.volume || 1}
                                                onChange={e => onVolumeChange && onVolumeChange(d.id, parseFloat(e.target.value))}
                                                className="flex-1"
                                            />
                                        </div>
                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button onClick={() => onMute && onMute(d.id)}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all
                          ${d.muted ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' : 'border-white/10 text-gray-400 hover:border-white/20'}`}>
                                                {d.muted ? <><VolumeX size={10} className="inline mr-1" />Unmute</> : <><VolumeX size={10} className="inline mr-1" />Mute</>}
                                            </button>
                                            <button onClick={() => onKick && onKick(d.id)}
                                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                                                <X size={10} className="inline mr-1" />Remove
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ))}

                {totalListeners === 0 && (
                    <div className="text-center py-10">
                        <Speaker size={32} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm" style={{ color: '#6b8fa8' }}>
                            No listeners yet.<br />Share your room code to invite others.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
