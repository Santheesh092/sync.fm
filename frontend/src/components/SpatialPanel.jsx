import { useState, useEffect } from 'react';
import { SPATIAL_ROLES, applySpatialRole } from '../lib/effectUtils';

export default function SpatialPanel({ audioNodes, onInitAudio }) {
    const [activeRole, setActiveRole] = useState('none');

    const handleSelect = (roleId) => {
        if (onInitAudio) onInitAudio();
        
        const newRole = activeRole === roleId ? 'none' : roleId;
        setActiveRole(newRole);
        
        if (audioNodes && audioNodes.ctx) {
            applySpatialRole(audioNodes.ctx, newRole, audioNodes);
        }
    };

    return (
        <div className="p-4 sm:p-6 animate-fade-in space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-[#00CFFF]/20 border border-[#00CFFF]/30 shadow-[0_0_20px_rgba(0,207,255,0.2)]">
                    <div className="text-2xl">🛰️</div>
                </div>
                <div>
                    <h3 className="text-xl font-black uppercase tracking-[0.15em] text-white/95 leading-none">Spatial Node</h3>
                    <p className="text-[10px] font-bold text-[#00CFFF]/80 uppercase tracking-widest mt-1">Distributed Surround Role</p>
                </div>
            </div>

            {/* Room Visualization */}
            <div className="relative aspect-video w-full rounded-[2.5rem] bg-[#020810] border border-white/5 overflow-hidden group shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-b from-[#00CFFF]/5 to-transparent pointer-events-none" />
                
                {/* Visual Grid/Floor */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_100%,#000_70%,transparent_100%)]" style={{ perspective: '500px', transform: 'rotateX(60deg)' }} />

                {/* Role Indicators in "3D" Space */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="relative w-4/5 h-4/5 border border-white/10 rounded-3xl [transform-style:preserve-3d]">
                        {/* Front Left */}
                        <div className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ${activeRole === 'front_left' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeRole === 'front_left' ? 'bg-[#00CFFF] shadow-[0_0_20px_#00CFFF]' : 'bg-white/10'}`}>🔊</div>
                        </div>
                        {/* Front Right */}
                        <div className={`absolute top-0 right-0 translate-x-1/2 -translate-y-1/2 transition-all duration-500 ${activeRole === 'front_right' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeRole === 'front_right' ? 'bg-[#00CFFF] shadow-[0_0_20px_#00CFFF]' : 'bg-white/10'}`}>🔊</div>
                        </div>
                        {/* Center */}
                        <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-500 ${activeRole === 'center' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeRole === 'center' ? 'bg-[#00CFFF] shadow-[0_0_20px_#00CFFF]' : 'bg-white/10'}`}>🗣️</div>
                        </div>
                        {/* Rear Left */}
                        <div className={`absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2 transition-all duration-500 ${activeRole === 'rear_left' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeRole === 'rear_left' ? 'bg-[#00CFFF] shadow-[0_0_20px_#00CFFF]' : 'bg-white/10'}`}>📡</div>
                        </div>
                        {/* Rear Right */}
                        <div className={`absolute bottom-0 right-0 translate-x-1/2 translate-y-1/2 transition-all duration-500 ${activeRole === 'rear_right' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${activeRole === 'rear_right' ? 'bg-[#00CFFF] shadow-[0_0_20px_#00CFFF]' : 'bg-white/10'}`}>📡</div>
                        </div>
                        {/* Subwoofer */}
                        <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 transition-all duration-500 ${activeRole === 'subwoofer' ? 'scale-125 opacity-100' : 'scale-100 opacity-30'}`}>
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${activeRole === 'subwoofer' ? 'bg-[#00CFFF] shadow-[0_0_30px_#00CFFF]' : 'bg-white/10'}`}>🌋</div>
                        </div>

                        {/* Center Listening Point */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/20 flex items-center justify-center animate-pulse">
                                <div className="w-2 h-2 rounded-full bg-[#00CFFF]" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
                    <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Virtual Soundstage View</span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {SPATIAL_ROLES.map(role => {
                    const isActive = activeRole === role.id;
                    return (
                        <button
                            key={role.id}
                            onClick={() => handleSelect(role.id)}
                            className={`relative overflow-hidden p-4 rounded-3xl flex items-center gap-3 transition-all duration-500 border text-left group
                                ${isActive 
                                    ? 'bg-[#00CFFF]/20 border-[#00CFFF]/50 shadow-[0_10px_30px_rgba(0,207,255,0.2)]' 
                                    : 'bg-[#0B121D]/50 border-white/5 hover:bg-white/5 hover:border-white/10'}`}
                        >
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-2xl transition-all duration-500 ${isActive ? 'bg-[#00CFFF] scale-110 rotate-3' : 'bg-white/5 group-hover:scale-105'}`}>
                                {role.emoji}
                            </div>
                            
                            <div className="flex-1">
                                <div className={`text-xs font-black uppercase tracking-wider mb-0.5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>
                                    {role.label}
                                </div>
                                <div className={`text-[8px] font-bold leading-tight uppercase tracking-tighter ${isActive ? 'text-[#00CFFF]/70' : 'text-gray-600'}`}>
                                    {role.desc}
                                </div>
                            </div>
                            
                            {isActive && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#00CFFF] animate-pulse shadow-[0_0_8px_#00CFFF]" />
                            )}
                        </button>
                    );
                })}
            </div>

            <div className="p-5 rounded-[2rem] bg-[#00CFFF]/5 border border-[#00CFFF]/10 relative overflow-hidden group">
                <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#00CFFF]/10 blur-2xl group-hover:bg-[#00CFFF]/20 transition-all duration-700" />
                <div className="relative z-10">
                    <div className="text-[10px] font-black text-[#00CFFF] uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-4 h-px bg-[#00CFFF]/30" /> How it works
                    </div>
                    <div className="text-[11px] text-gray-400 font-bold leading-relaxed tracking-tight">
                        Place this device in the position matching its role. Together with other devices, it creates a full <span className="text-white">360° immersive audio stage</span>. Best experienced with room-filling volume.
                    </div>
                </div>
            </div>

        </div>
    );
}

