import {
    Play, Pause, Square, SkipBack, SkipForward,
    Shuffle, Repeat, Volume2, VolumeX, Repeat1
} from 'lucide-react';

export default function PlayerControls({
    isPlaying,
    isMuted,
    volume,
    currentTime,
    duration,
    shuffle,
    loop,          // 'none' | 'all' | 'one'
    onPlay,
    onPause,
    onStop,
    onPrev,
    onNext,
    onSeek,
    onVolume,
    onMute,
    onShuffle,
    onLoop,
    isHost = true,
}) {
    const fmt = (s) => {
        if (!s || isNaN(s)) return '0:00';
        const m = Math.floor(s / 60), sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    const pct = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div className="flex flex-col gap-4">
            {/* Main controls */}
            <div className="flex items-center justify-center gap-3">
                {/* Shuffle */}
                <button onClick={isHost ? onShuffle : undefined}
                    className={`p-2 rounded-lg transition-all ${shuffle ? 'text-yellow-400' : 'opacity-50 hover:opacity-80'}`}
                    title="Shuffle" disabled={!isHost}>
                    <Shuffle size={18} />
                </button>

                {/* Previous */}
                <button onClick={isHost ? onPrev : undefined}
                    className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-all disabled:opacity-30"
                    disabled={!isHost} title="Previous">
                    <SkipBack size={22} />
                </button>

                {/* Play / Pause */}
                <button
                    onClick={() => isHost && (isPlaying ? onPause() : onPlay())}
                    disabled={!isHost}
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-40"
                    style={{
                        background: 'linear-gradient(135deg, #F2C21A, #c9a010)',
                        boxShadow: isPlaying ? '0 0 24px rgba(242,194,26,0.5)' : 'none',
                    }}
                    title={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying
                        ? <Pause size={22} fill="currentColor" color="#050E1A" />
                        : <Play size={22} fill="currentColor" color="#050E1A" className="translate-x-0.5" />}
                </button>

                {/* Next */}
                <button onClick={isHost ? onNext : undefined}
                    className="p-2 rounded-lg opacity-70 hover:opacity-100 transition-all disabled:opacity-30"
                    disabled={!isHost} title="Next">
                    <SkipForward size={22} />
                </button>

                {/* Loop */}
                <button onClick={isHost ? onLoop : undefined}
                    disabled={!isHost}
                    className={`p-2 rounded-lg transition-all ${loop !== 'none' ? 'text-yellow-400' : 'opacity-50 hover:opacity-80'}`}
                    title="Loop">
                    {loop === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
                </button>
            </div>

        </div>
    );
}
