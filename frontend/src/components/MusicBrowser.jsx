import React, { useRef, useState, useMemo } from 'react';
import { useMusic } from '../store/MusicContext';
import { scanFiles, scanDirectory } from '../utils/fileScanner';
import { parseMetadata } from '../utils/metadataParser';
import { 
  Folder, Music, LayoutGrid, List, Search, X, Loader2, Play, Plus, 
  FolderOpen, Disc, Calendar, Clock, HardDrive, ShieldAlert
} from 'lucide-react';

export default function MusicBrowser({ onSelectTrack, onLoadDeck, onClose, mode = 'room' }) {
  const fileInputRef = useRef(null);
  const { state, dispatch } = useMusic();
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 });
  const [activeAlbum, setActiveAlbum] = useState(null); // For drill-down Album View

  const hasDirectoryPicker = typeof window.showDirectoryPicker === 'function';

  const formatDuration = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 MB';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  // Generate dynamic, premium-looking abstract gradients based on string hash
  const getGradientColor = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash % 360);
    const h2 = (h1 + 60) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 80%, 45%) 0%, hsl(${h2}, 85%, 25%) 100%)`;
  };

  const handleScan = async (useDirectoryPicker = false) => {
    try {
      setIsScanning(true);
      setScanProgress({ current: 0, total: 0 });
      if (useDirectoryPicker) {
        const files = await scanDirectory();
        await processFiles(files);
      } else {
        fileInputRef.current && fileInputRef.current.click();
      }
    } catch (e) {
      console.error(e);
      alert(e.message || 'Failed to scan files.');
      setIsScanning(false);
    }
  };

  const handleFileInputChange = async (e) => {
    if (!e.target.files) return;
    try {
      const files = await scanFiles(e.target.files);
      await processFiles(files);
    } catch (err) {
      console.error(err);
      alert('Error parsing selected files.');
      setIsScanning(false);
    }
  };

  const processFiles = async (files) => {
    if (files.length === 0) {
      setIsScanning(false);
      return;
    }
    setIsScanning(true);
    setScanProgress({ current: 0, total: files.length });
    const parsedTracks = [];
    
    // Parse files in batches of 5 to keep browser UI active and responsive
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (file) => {
          const meta = await parseMetadata(file);
          return {
            file,
            title: meta.title || file.name.replace(/\.[^.]+$/, ''),
            artist: meta.artist || 'Unknown Artist',
            album: meta.album || 'Unknown Album',
            genre: meta.genre || 'Unknown Genre',
            duration: meta.duration || 0,
            size: file.size,
            quality: meta.bitrate ? `${meta.bitrate} kbps` : '192 kbps',
            year: meta.year || 'Unknown Year',
            bpm: meta.bpm || 128,
            folderName: file.folderName || 'Root',
          };
        })
      );
      parsedTracks.push(...results);
      setScanProgress({ current: Math.min(i + batchSize, files.length), total: files.length });
    }
    
    dispatch({ type: 'ADD_TRACKS', payload: parsedTracks });
    setIsScanning(false);
  };

  const handleSearchChange = (e) => {
    dispatch({ type: 'SET_FILTER', payload: e.target.value });
  };

  const handleViewModeChange = (modeName) => {
    dispatch({ type: 'SET_VIEW_MODE', payload: modeName });
    setActiveAlbum(null); // Reset detail view
  };

  const clearLibrary = () => {
    if (window.confirm('Are you sure you want to clear your local music library?')) {
      dispatch({ type: 'CLEAR_LIBRARY' });
      setActiveAlbum(null);
    }
  };

  // Grouping for Album View
  const albums = useMemo(() => {
    const groups = {};
    state.filteredTracks.forEach(track => {
      const name = track.album || 'Unknown Album';
      if (!groups[name]) {
        groups[name] = { name, artist: track.artist, tracks: [] };
      }
      groups[name].tracks.push(track);
    });
    return Object.values(groups);
  }, [state.filteredTracks]);

  // Grouping for Folder View
  const folders = useMemo(() => {
    const groups = {};
    state.filteredTracks.forEach(track => {
      const name = track.folderName || 'Root';
      if (!groups[name]) {
        groups[name] = [];
      }
      groups[name].push(track);
    });
    return Object.entries(groups).map(([name, tracks]) => ({ name, tracks }));
  }, [state.filteredTracks]);

  // Track rendering within Folder View
  const [expandedFolders, setExpandedFolders] = useState({});
  const toggleFolder = (folderName) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  return (
    <div className="fixed inset-0 z-[120] backdrop-blur-md bg-black/70 flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-6xl h-[90vh] bg-[#071324] border border-[#00CFFF]/25 rounded-[32px] flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6),_inset_0_0_30px_rgba(0,207,255,0.05)] relative">
        
        {/* Soft Volumetric Background Glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none opacity-10 bg-[#00CFFF]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] rounded-full blur-[150px] pointer-events-none opacity-10 bg-[#F2C21A]" />

        {/* Header Section */}
        <header className="p-6 border-b border-white/5 bg-white/2 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00CFFF]/10 border border-[#00CFFF]/20 flex items-center justify-center">
              <Disc className="text-[#00CFFF] animate-spin-slow" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-widest uppercase italic text-white">
                DEVICE MUSIC<span className="text-[#00CFFF]">LIBRARY</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/30">
                {state.tracks.length} Scanned Tracks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state.tracks.length > 0 && (
              <button
                onClick={clearLibrary}
                className="px-3 py-1.5 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 text-xs font-black uppercase tracking-wider transition-all"
              >
                Clear Library
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Toolbar Section */}
        <section className="px-6 py-4 border-b border-white/5 flex flex-wrap gap-4 items-center justify-between z-10 bg-black/10">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" size={16} />
            <input
              type="text"
              placeholder="Search by title, artist, album, genre, year..."
              value={state.filter}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#00CFFF]/50 transition-all font-medium"
            />
          </div>

          {/* View Mode Buttons */}
          <div className="flex gap-1.5 p-1 bg-black/40 rounded-2xl border border-white/5">
            {[
              { id: 'list', icon: <List size={14} />, label: 'List' },
              { id: 'grid', icon: <LayoutGrid size={14} />, label: 'Grid' },
              { id: 'album', icon: <Disc size={14} />, label: 'Albums' },
              { id: 'folder', icon: <FolderOpen size={14} />, label: 'Folders' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleViewModeChange(tab.id)}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${state.viewMode === tab.id ? 'bg-[#00CFFF] text-black shadow-[0_0_15px_rgba(0,207,255,0.3)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Folder Scanning Button */}
          <div className="flex gap-2">
            <input
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileInputChange}
            />
            {hasDirectoryPicker && (
              <button
                onClick={() => handleScan(true)}
                disabled={isScanning}
                className="px-4 py-2.5 bg-[#00CFFF]/10 border border-[#00CFFF]/20 hover:bg-[#00CFFF]/20 text-[#00CFFF] font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all flex items-center gap-2"
              >
                <Folder size={14} /> Scan Folder
              </button>
            )}
            <button
              onClick={() => handleScan(false)}
              disabled={isScanning}
              className="px-4 py-2.5 bg-gradient-to-r from-[#00CFFF] to-[#0087FF] text-black font-black uppercase text-[10px] tracking-widest rounded-2xl transition-all shadow-[0_4px_15px_rgba(0,207,255,0.2)] hover:scale-[1.02] flex items-center gap-2"
            >
              <Plus size={14} /> Choose Files
            </button>
          </div>
        </section>

        {/* Scan Progress Bar Overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-[#071324]/90 z-20 flex flex-col items-center justify-center p-6 backdrop-blur-sm">
            <div className="max-w-md w-full text-center">
              <Loader2 className="animate-spin text-[#00CFFF] mx-auto mb-6" size={48} />
              <h2 className="text-xl font-black italic tracking-widest text-white mb-2">SCANNING MUSIC FILES</h2>
              <p className="text-xs text-white/40 mb-6 font-bold uppercase tracking-wider">
                Extracting metadata and ID3 tags. Please wait...
              </p>
              
              {scanProgress.total > 0 && (
                <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden border border-white/5 p-[1px]">
                  <div 
                    className="h-full bg-gradient-to-r from-[#00CFFF] to-[#0087FF] rounded-full transition-all duration-300"
                    style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                  />
                </div>
              )}
              <div className="text-xs font-mono font-bold mt-2 text-[#00CFFF]">
                {scanProgress.current} / {scanProgress.total} parsed
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 z-10">
          {state.tracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                <Music className="text-white/20" size={32} />
              </div>
              <h2 className="text-lg font-black italic tracking-wider text-white mb-2">YOUR MUSIC LIBRARY IS EMPTY</h2>
              <p className="text-xs text-white/40 leading-relaxed mb-6 font-medium">
                Vibez.fm scans audio files directly from your local downloads, music, or selected folders. No files are uploaded to the cloud without your intent, keeping it secure.
              </p>
              <div className="flex flex-col gap-2 w-full">
                {hasDirectoryPicker && (
                  <button
                    onClick={() => handleScan(true)}
                    className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all text-white"
                  >
                    Select Folder to Scan
                  </button>
                )}
                <button
                  onClick={() => handleScan(false)}
                  className="w-full py-3 bg-gradient-to-r from-[#00CFFF] to-[#0087FF] text-black rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_5px_15px_rgba(0,207,255,0.2)]"
                >
                  Browse Audio Files
                </button>
              </div>
            </div>
          ) : state.filteredTracks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <ShieldAlert className="text-white/20 mb-4" size={48} />
              <h3 className="text-base font-black italic tracking-widest text-white mb-1">NO TRACKS FOUND</h3>
              <p className="text-xs text-white/40 font-medium">No files match your query "{state.filter}". Try checking your spelling.</p>
            </div>
          ) : (
            <>
              {/* LIST VIEW */}
              {state.viewMode === 'list' && (
                <div className="overflow-x-auto min-w-full rounded-2xl border border-white/5 bg-black/10">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/2 font-black text-white/40 uppercase tracking-wider">
                        <th className="p-4 pl-6">Title</th>
                        <th className="p-4">Artist</th>
                        <th className="p-4">Album</th>
                        <th className="p-4">Genre</th>
                        <th className="p-4 text-center"><Clock size={14} className="mx-auto" /></th>
                        <th className="p-4 text-right"><HardDrive size={14} className="ml-auto inline mr-1" /> Size</th>
                        <th className="p-4">Quality</th>
                        <th className="p-4 text-right pr-6">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium">
                      {state.filteredTracks.map((t, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                          <td className="p-4 pl-6 flex items-center gap-3 max-w-[220px]">
                            <div 
                              className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center relative overflow-hidden"
                              style={{ background: getGradientColor(t.title) }}
                            >
                              <Music size={12} className="text-white/80" />
                            </div>
                            <div className="truncate">
                              <span className="font-bold text-white block truncate">{t.title}</span>
                              <span className="text-[10px] text-white/40 block truncate">{t.folderName}</span>
                            </div>
                          </td>
                          <td className="p-4 text-white/60 truncate max-w-[140px]">{t.artist}</td>
                          <td className="p-4 text-white/40 truncate max-w-[140px]">{t.album}</td>
                          <td className="p-4 text-white/40 truncate">{t.genre}</td>
                          <td className="p-4 text-center text-white/60 font-mono">{formatDuration(t.duration)}</td>
                          <td className="p-4 text-right text-white/40 font-mono">{formatSize(t.size)}</td>
                          <td className="p-4 text-white/30 font-mono text-[10px]">{t.quality}</td>
                          <td className="p-4 text-right pr-6">
                            <ActionButtons mode={mode} track={t} onPlay={onSelectTrack} onLoadDeck={onLoadDeck} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* GRID VIEW */}
              {state.viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {state.filteredTracks.map((t, idx) => (
                    <div 
                      key={idx} 
                      className="glass-panel p-4 rounded-3xl border border-white/5 bg-white/2 hover:border-[#00CFFF]/30 hover:bg-[#00CFFF]/5 transition-all duration-300 group flex flex-col relative overflow-hidden"
                    >
                      <div 
                        className="w-full aspect-square rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center shadow-lg group-hover:scale-[1.03] transition-all duration-300"
                        style={{ background: getGradientColor(t.title) }}
                      >
                        <Disc size={44} className="text-white/20 animate-spin-slow" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 px-3">
                          <ActionButtons mode={mode} track={t} onPlay={onSelectTrack} onLoadDeck={onLoadDeck} layout="card" />
                        </div>
                      </div>
                      <h4 className="font-bold text-xs text-white truncate w-full mb-1">{t.title}</h4>
                      <p className="text-[10px] text-[#00CFFF] font-bold truncate w-full mb-1">{t.artist}</p>
                      <div className="flex justify-between items-center text-[9px] text-white/30 font-mono mt-auto">
                        <span>{formatDuration(t.duration)}</span>
                        <span>{t.quality}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ALBUM VIEW */}
              {state.viewMode === 'album' && (
                <>
                  {!activeAlbum ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                      {albums.map((alb, idx) => (
                        <div 
                          key={idx}
                          onClick={() => setActiveAlbum(alb)}
                          className="glass-panel p-4 rounded-3xl border border-white/5 bg-white/2 hover:border-[#00CFFF]/30 hover:bg-[#00CFFF]/5 cursor-pointer transition-all duration-300 group flex flex-col relative"
                        >
                          <div 
                            className="w-full aspect-square rounded-2xl mb-4 relative overflow-hidden flex items-center justify-center shadow-lg"
                            style={{ background: getGradientColor(alb.name) }}
                          >
                            <Disc size={48} className="text-white/30" />
                            <div className="absolute bottom-2 right-2 bg-black/60 px-2 py-0.5 rounded font-mono text-[8px] text-white font-bold">
                              {alb.tracks.length} tracks
                            </div>
                          </div>
                          <h4 className="font-bold text-xs text-white truncate w-full mb-1">{alb.name}</h4>
                          <p className="text-[10px] text-white/40 truncate w-full">{alb.artist}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
                      <button 
                        onClick={() => setActiveAlbum(null)}
                        className="self-start px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all"
                      >
                        ← Back to Albums
                      </button>

                      <div className="flex gap-6 items-center p-6 bg-white/2 rounded-3xl border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 w-full h-full opacity-5 pointer-events-none" style={{ background: getGradientColor(activeAlbum.name) }} />
                        <div 
                          className="w-24 h-24 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xl"
                          style={{ background: getGradientColor(activeAlbum.name) }}
                        >
                          <Disc size={36} className="text-white/40 animate-spin-slow" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-black text-white italic tracking-tight">{activeAlbum.name}</h2>
                          <p className="text-[#00CFFF] text-xs font-bold uppercase tracking-wider mt-1">{activeAlbum.artist}</p>
                          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-2">{activeAlbum.tracks.length} Tracks Scanned</p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/10">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/5 bg-white/2 font-black text-white/40 uppercase tracking-wider">
                              <th className="p-4 pl-6">Title</th>
                              <th className="p-4">Genre</th>
                              <th className="p-4 text-center"><Clock size={14} className="mx-auto" /></th>
                              <th className="p-4 text-right"><HardDrive size={14} className="ml-auto inline mr-1" /> Size</th>
                              <th className="p-4">Quality</th>
                              <th className="p-4 text-right pr-6">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 font-medium">
                            {activeAlbum.tracks.map((t, idx) => (
                              <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="p-4 pl-6 font-bold text-white">{t.title}</td>
                                <td className="p-4 text-white/40">{t.genre}</td>
                                <td className="p-4 text-center text-white/60 font-mono">{formatDuration(t.duration)}</td>
                                <td className="p-4 text-right text-white/40 font-mono">{formatSize(t.size)}</td>
                                <td className="p-4 text-white/30 font-mono">{t.quality}</td>
                                <td className="p-4 text-right pr-6">
                                  <ActionButtons mode={mode} track={t} onPlay={onSelectTrack} onLoadDeck={onLoadDeck} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* FOLDER VIEW */}
              {state.viewMode === 'folder' && (
                <div className="space-y-4">
                  {folders.map((folder, idx) => {
                    const isExpanded = expandedFolders[folder.name];
                    return (
                      <div 
                        key={idx}
                        className="glass-panel rounded-2xl border border-white/5 bg-white/1 overflow-hidden"
                      >
                        <button
                          onClick={() => toggleFolder(folder.name)}
                          className="w-full flex items-center justify-between p-4 bg-white/2 hover:bg-white/5 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3">
                            <Folder className={isExpanded ? 'text-[#00CFFF]' : 'text-white/40'} size={18} />
                            <span className="font-bold text-xs text-white uppercase tracking-wider">{folder.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 font-mono text-white/40">
                              {folder.tracks.length} tracks
                            </span>
                          </div>
                          <span className="text-xs text-white/30">{isExpanded ? 'Collapse ▲' : 'Expand ▼'}</span>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-white/5 overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-white/5 bg-black/20 font-black text-white/30 uppercase tracking-wider">
                                  <th className="p-4 pl-6">Title</th>
                                  <th className="p-4">Artist</th>
                                  <th className="p-4">Album</th>
                                  <th className="p-4 text-center"><Clock size={14} className="mx-auto" /></th>
                                  <th className="p-4 text-right">Size</th>
                                  <th className="p-4 text-right pr-6">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/5 font-medium">
                                {folder.tracks.map((t, tidx) => (
                                  <tr key={tidx} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 pl-6 font-bold text-white truncate max-w-[200px]">{t.title}</td>
                                    <td className="p-4 text-white/60 truncate max-w-[140px]">{t.artist}</td>
                                    <td className="p-4 text-white/40 truncate max-w-[140px]">{t.album}</td>
                                    <td className="p-4 text-center text-white/60 font-mono">{formatDuration(t.duration)}</td>
                                    <td className="p-4 text-right text-white/40 font-mono">{formatSize(t.size)}</td>
                                    <td className="p-4 text-right pr-6">
                                      <ActionButtons mode={mode} track={t} onPlay={onSelectTrack} onLoadDeck={onLoadDeck} />
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Compact Actions renderer helper based on Mode
function ActionButtons({ mode, track, onPlay, onLoadDeck, layout = 'row' }) {
  if (mode === 'dj') {
    return (
      <div className={`flex gap-1.5 ${layout === 'card' ? 'flex-col w-full' : ''}`}>
        <button
          onClick={() => onLoadDeck && onLoadDeck('A', track.file)}
          className="px-2.5 py-1.5 bg-[#00CFFF] text-black text-[9px] font-black rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
        >
          <Plus size={10} /> LOAD A
        </button>
        <button
          onClick={() => onLoadDeck && onLoadDeck('B', track.file)}
          className="px-2.5 py-1.5 bg-[#CC44FF] text-white text-[9px] font-black rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
        >
          <Plus size={10} /> LOAD B
        </button>
      </div>
    );
  }

  // Room Mode controls
  return (
    <div className={`flex gap-1.5 ${layout === 'card' ? 'flex-col w-full' : ''}`}>
      <button
        onClick={() => onPlay && onPlay(track.file, track)}
        className="px-3 py-1.5 bg-[#F2C21A] text-black text-[10px] font-black rounded-lg transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
      >
        <Play size={10} fill="currentColor" /> Play Now
      </button>
    </div>
  );
}
