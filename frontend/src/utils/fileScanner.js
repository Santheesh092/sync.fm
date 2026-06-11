export const scanFiles = async (inputFiles) => {
  const supported = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'aiff', 'alac'];
  const files = [];
  for (let i = 0; i < inputFiles.length; i++) {
    const file = inputFiles[i];
    const ext = file.name.split('.').pop().toLowerCase();
    if (supported.includes(ext)) {
      // Basic folderName from webkitRelativePath if selected via directory input
      const pathParts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [];
      file.folderName = pathParts.length > 1 ? pathParts.slice(0, -1).join('/') : 'Selected Files';
      files.push(file);
    }
  }
  return files;
};

export const scanDirectory = async () => {
  if (typeof window.showDirectoryPicker !== 'function') {
    throw new Error('Directory scanning is not natively supported in this browser. Please use file selection instead.');
  }
  
  const dirHandle = await window.showDirectoryPicker();
  const files = [];

  const scan = async (handle, path = '') => {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file') {
        try {
          const file = await entry.getFile();
          const ext = file.name.split('.').pop().toLowerCase();
          const supported = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'aiff', 'alac'];
          if (supported.includes(ext)) {
            file.folderName = path || 'Root';
            files.push(file);
          }
        } catch (e) {
          console.warn('Could not read file:', entry.name, e);
        }
      } else if (entry.kind === 'directory') {
        await scan(entry, path ? `${path}/${entry.name}` : entry.name);
      }
    }
  };

  await scan(dirHandle);
  return files;
};
