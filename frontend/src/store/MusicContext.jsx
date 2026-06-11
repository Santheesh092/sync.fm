import React, { createContext, useReducer, useContext, useEffect } from 'react';

const ADD_TRACKS = 'ADD_TRACKS';
const SET_FILTER = 'SET_FILTER';
const SET_VIEW_MODE = 'SET_VIEW_MODE';
const CLEAR_LIBRARY = 'CLEAR_LIBRARY';

const initialState = {
  tracks: [], // List of all track objects { file, title, artist, album, genre, duration, size, quality, year, bpm, folderName }
  filter: '',
  filteredTracks: [],
  viewMode: 'list', // 'list' | 'grid' | 'album' | 'folder'
};

function musicReducer(state, action) {
  switch (action.type) {
    case ADD_TRACKS: {
      // Avoid duplicate tracks by using file name + size
      const existingKeys = new Set(state.tracks.map(t => `${t.title}-${t.size}`));
      const newTracks = action.payload.filter(t => !existingKeys.has(`${t.title}-${t.size}`));
      const combined = [...state.tracks, ...newTracks];
      return {
        ...state,
        tracks: combined,
        filteredTracks: filterTracks(combined, state.filter),
      };
    }
    case SET_FILTER:
      return {
        ...state,
        filter: action.payload,
        filteredTracks: filterTracks(state.tracks, action.payload),
      };
    case SET_VIEW_MODE:
      return {
        ...state,
        viewMode: action.payload,
      };
    case CLEAR_LIBRARY:
      return { ...initialState };
    default:
      return state;
  }
}

function filterTracks(tracks, query) {
  if (!query) return tracks;
  const lowered = query.toLowerCase();
  return tracks.filter(t =>
    (t.title && t.title.toLowerCase().includes(lowered)) ||
    (t.artist && t.artist.toLowerCase().includes(lowered)) ||
    (t.album && t.album.toLowerCase().includes(lowered)) ||
    (t.genre && t.genre.toLowerCase().includes(lowered)) ||
    (t.folderName && t.folderName.toLowerCase().includes(lowered)) ||
    (t.year && String(t.year).includes(lowered))
  );
}

const MusicContext = createContext();

export function MusicProvider({ children }) {
  const [state, dispatch] = useReducer(musicReducer, initialState);
  return (
    <MusicContext.Provider value={{ state, dispatch }}>
      {children}
    </MusicContext.Provider>
  );
}

export function useMusic() {
  const context = useContext(MusicContext);
  if (!context) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}
