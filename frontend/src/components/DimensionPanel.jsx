import { useState } from 'react';
import { Download, Layers, Box, Zap, Sparkles } from 'lucide-react';
import { DIMENSIONS, applyDimensionEffect } from '../lib/effectUtils';
import { exportDimensionAudio } from '../lib/downloadUtils';

const DIMENSION_COLORS = {
    '2d': '#FF4444',
    '3d': '#FF8C00',
    '4d': '#F2C21A',
    '6d': '#00FF88',
    '8d': '#00CFFF',
    '9d': '#3B82F6',
    '16d': '#CC44FF',
    '24d': '#FF44FF',
    '36d': '#FF44BB',
};

export default function DimensionPanel({ audioNodes, trackUrl, trackTitle }) {
    const [activeDim, setActiveDim] = useState(null);
    const [isDownloading, setIsDownloading] = useState(null);

    const handleSelect = (dim) => {
        const isToggleOff = activeDim === dim.id;
        setActiveDim(isToggleOff ? null : dim.id);
        
        if (audioNodes) {
            applyDimensionEffect(audioNodes.ctx, isToggleOff ? 'none' : dim.id, audioNodes);
        }
    };

    const handleDownload = async (e, dim) => {
        e.stopPropagation();
        
        if (!trackUrl) {
            alert("No track loaded to download.");
            return;
        }

        setIsDownloading(dim.id);
        
        try {
            alert(`Preparing ${dim.label} version for download... This may take a few seconds.`);
            
            await exportDimensionAudio(trackUrl, dim.id, {
                title: trackTitle || 'Processed',
                // We could pass Eq gains here if we tracked them
            });
            
            setIsDownloading(null);
        } catch (err) {
            console.error("Export failed", err);
            alert("Failed to convert audio. Please check your connection.");
            setIsDownloading(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/5">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#F2C21A]/10 border border-[#F2C21A]/20">
                    <div className="text-xl">📐</div>
                </div>
                <div>
                    <h3 className="text-lg font-black uppercase tracking-widest text-white/90">Dimension Modes</h3>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">Spatial Resolution • Orbital Movement</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DIMENSIONS.map((dim) => {
                    const isActive = activeDim === dim.id;
                    const color = DIMENSION_COLORS[dim.id] || '#F2C21A';
                    
                    return (
                        <div key={dim.id} 
                            onClick={() => handleSelect(dim)}
                            className={`group relative p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 overflow-hidden ${isActive ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
                            style={{
                                background: isActive ? `${color}15` : 'rgba(255,255,255,0.03)',
                                borderColor: isActive ? color : 'rgba(255,255,255,0.05)',
                                boxShadow: isActive ? `0 0 30px ${color}20` : 'none'
                            }}>
                            
                            {/* Animated Background Glow */}
                            {isActive && (
                                <div className="absolute inset-0 opacity-20 pointer-events-none">
                                    <div className="absolute top-0 left-0 w-full h-full animate-pulse" 
                                        style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }} />
                                </div>
                            )}

                            <div className="relative z-10 flex items-start justify-between">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl">{dim.emoji}</span>
                                        <span className="text-sm font-black uppercase tracking-widest" style={{ color: isActive ? color : '#fff' }}>
                                            {dim.label}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-white/40 mt-1 uppercase leading-tight">
                                        {dim.desc}
                                    </p>
                                </div>

                                <button 
                                    onClick={(e) => handleDownload(e, dim)}
                                    disabled={isDownloading === dim.id}
                                    className={`p-2 rounded-lg transition-all duration-300 ${isDownloading === dim.id ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'}`}
                                    title="Download this version"
                                >
                                    {isDownloading === dim.id ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Download size={18} />
                                    )}
                                </button>
                            </div>

                            {/* Dimension Indicator Bar */}
                            <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-1000 ${isActive ? 'animate-shimmer' : ''}`}
                                    style={{ 
                                        width: isActive ? '100%' : '20%',
                                        background: `linear-gradient(90deg, transparent, ${color}, transparent)`
                                    }} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {activeDim && (
                <div className="mt-6 p-4 rounded-xl border border-white/10 animate-in slide-in-from-bottom-2 duration-300"
                    style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Sparkles size={16} className="text-[#F2C21A] animate-pulse" />
                            <span className="text-xs font-black uppercase tracking-widest text-[#F2C21A]">
                                {DIMENSIONS.find(d => d.id === activeDim)?.label} Active
                            </span>
                        </div>
                        <div className="text-[10px] font-bold text-white/40 uppercase">
                            Processing Spatial Layers...
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
