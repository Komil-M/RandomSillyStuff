import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getState: () => ipcRenderer.invoke('app:get-state'),
  setToken: (token) => ipcRenderer.invoke('app:set-token', token),
  setAccount: (accountName) => ipcRenderer.invoke('app:set-account', accountName),
  openAuth: () => ipcRenderer.invoke('app:open-auth'),
  refreshCharacters: () => ipcRenderer.invoke('app:refresh-characters'),
  pickCharacter: (name) => ipcRenderer.invoke('app:pick-character', name),
  addGuide: (payload) => ipcRenderer.invoke('app:add-guide', payload),
  getGuides: () => ipcRenderer.invoke('app:get-guides'),
  selectGuide: (guideId) => ipcRenderer.invoke('app:select-guide', guideId),
  advanceGuideStep: (guideId) => ipcRenderer.invoke('app:advance-guide-step', guideId),
  resetGuideProgress: (guideId) => ipcRenderer.invoke('app:reset-guide-progress', guideId),
  deleteGuide: (guideId) => ipcRenderer.invoke('app:delete-guide', guideId),
  updateOverlay: (payload) => ipcRenderer.invoke('overlay:update-mapping', payload),
  onStateUpdate: (callback) => {
    ipcRenderer.on('state:updated', (_event, data) => callback(data));
  },
  onOverlayUpdate: (callback) => {
    ipcRenderer.on('overlay:update', (_event, data) => callback(data));
  },
});
