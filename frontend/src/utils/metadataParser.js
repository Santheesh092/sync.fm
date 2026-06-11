import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
import { parseBlob } from 'music-metadata-browser';

export async function parseMetadata(file) {
  try {
    const metadata = await parseBlob(file);
    return {
      title: metadata.common.title || file.name,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      genre: metadata.common.genre?.join(', ') || 'Unknown Genre',
      duration: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : null,
      year: metadata.common.year || null,
    };
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return {
      title: file.name,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: 'Unknown Genre',
      duration: 0,
      bitrate: null,
      year: null,
    };
  }
}
