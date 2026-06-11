import React, { useContext } from 'react';
import { useMusic } from '../../store/MusicContext';
import { formatTime } from '../../utils/formatTime';

export default function AudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    audioRef,
    volume,
    isMuted,
    dispatch,
    seek,
  } = useMusic();

  const handleVolumeChange = (e) => {
    const vol = parseFloat(e.target.value);
    dispatch({ type: 'SET_VOLUME', payload: vol });
    if (audioRef.current) audioRef.current.volume = vol;
  };

  const handleMute = () => {
    dispatch({ type: 'SET_MUTED', payload: !isMuted });
    if (audioRef.current) audioRef.current.volume = isMuted ? volume : 0;
  };

  const handleProgress = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * (audioRef.current?.duration || 0);
    seek(newTime);
    if (audioRef.current) audioRef.current.currentTime = newTime;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm p-3 flex items-center gap-4 text-white">
      <button onClick={togglePlay} className="p-2 hover:bg-gray-800 rounded">
        {isPlaying ? <span>⏸</span> : <span>▶️</span>}
      </button>
      <div className="flex-1" onClick={handleProgress} style={{ cursor: 'pointer' }}>
        <div className="w-full h-1 bg-gray-700 rounded">
          <div
            className="h-1 bg-yellow-500 rounded"
            style={{ width: `${(audioRef.current?.currentTime || 0) / (audioRef.current?.duration || 1) * 100}%` }}
          />
        </div>
      </div>
      <div className="text-sm min-w-[80px]">
        {currentTrack ? `${formatTime(audioRef.current?.currentTime || 0)} / ${formatTime(currentTrack.duration || 0)}` : '--:--'}
      </div>
      <button onClick={handleMute} className="p-1 hover:bg-gray-800 rounded">
        {isMuted ? <span>🔇</span> : <span>🔊</span>}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={isMuted ? 0 : volume}
        onChange={handleVolumeChange}
        className="w-24"
      />
    </div>
  );
}
