import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
import { parseBlob } from 'music-metadata-browser';

export async function parseMetadata(file) {
  try {
    const metadata = await parseBlob(file, { size: file.size, mimeType: file.type });
    return {
      title: metadata.common.title || file.name,
      artist: metadata.common.artist || 'Unknown Artist',
      album: metadata.common.album || 'Unknown Album',
      genre: metadata.common.genre?.join(', ') || 'Unknown Genre',
      duration: metadata.format.duration || 0,
      bitrate: metadata.format.bitrate ? Math.round(metadata.format.bitrate / 1000) : null,
      year: metadata.common.year || null,
      picture:
        metadata.common.picture && metadata.common.picture.length > 0
          ? `data:${metadata.common.picture[0].format};base64,${metadata.common.picture[0].data.toString('base64')}`
          : null,
    };
  } catch (error) {
    // Silently handle parsing errors, return defaults
    return {
      title: file.name,
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: 'Unknown Genre',
      duration: 0,
      bitrate: null,
      year: null,
      picture: null,
    };
  }
}
