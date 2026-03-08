import { app, BrowserWindow, ipcMain, shell, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigStore } from './services/configStore.js';
import { PoeApi } from './services/poeApi.js';
import { PoeLogWatcher } from './services/logWatcher.js';
import { parseGuidePayload } from './services/routeEngine.js';
import { sampleTree } from './services/treeData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const store = new ConfigStore(path.join(app.getPath('userData'), 'poe-qol-state.json'));

const CLIENT_ID = process.env.POE_CLIENT_ID || '';
const REDIRECT_URI = process.env.POE_REDIRECT_URI || 'https://www.pathofexile.com/';
const AUTH_SCOPES = [
  'account:character',
  'account:leagues',
  'account:stashes',
].join(' ');

let state = {
  token: null,
  accountName: '',
  characters: [],
  activeCharacter: '',
  mission: { text: 'Unknown', source: 'idle' },
  guides: [],
  selectedGuideId: '',
  overlay: {
    visible: true,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  },
};

const windows = {
  dashboard: null,
  overlay: null,
};

let poeApi = null;
let pollTimer = null;
let logWatcher = null;

function persistState() {
  const toStore = {
    token: state.token,
    accountName: state.accountName,
    activeCharacter: state.activeCharacter,
    mission: state.mission,
    guides: state.guides,
    selectedGuideId: state.selectedGuideId,
    overlay: state.overlay,
  };
  store.setState(toStore);
}

function getSelectedGuide() {
  return state.guides.find((guide) => guide.id === state.selectedGuideId) || null;
}

function getOverlayPayload() {
  const guide = getSelectedGuide();
  return {
    mission: state.mission,
    overlay: state.overlay,
    character: state.characters.find((entry) => entry.name === state.activeCharacter) || null,
    activeCharacter: state.activeCharacter,
    accountName: state.accountName,
    selectedGuide: guide,
    routeNodes: guide?.nodes || [],
    treeData: sampleTree,
  };
}

function sendStateUpdate() {
  if (windows.dashboard && !windows.dashboard.isDestroyed()) {
    windows.dashboard.webContents.send('state:updated', state);
  }
  if (windows.overlay && !windows.overlay.isDestroyed()) {
    windows.overlay.webContents.send('overlay:update', getOverlayPayload());
  }
}

function clearPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function refreshCharacters() {
  if (!state.token) return { ok: false, error: 'No auth token set.' };
  try {
    const profile = await poeApi.getProfile();
    state.accountName = profile.name || state.accountName;
    state.characters = await poeApi.getCharacters(state.accountName);
    if (!state.activeCharacter && state.characters.length > 0) {
      state.activeCharacter = state.characters[0].name;
    }
    persistState();
    sendStateUpdate();
    return { ok: true, characters: state.characters };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
}

async function refreshCharacterStats() {
  if (!state.token || !state.activeCharacter || !state.accountName) return;
  try {
    const profile = await poeApi.getProfile();
    state.accountName = profile.name || state.accountName;
    const list = await poeApi.getCharacters(state.accountName);
    state.characters = list;
    const active = list.find((entry) => entry.name === state.activeCharacter);
    if (active) {
      const detail = await poeApi.getCharacter(state.accountName, active.name);
      state.mission = {
        text: detail.currentArea || detail.currentact || active.lastAreaChange || detail.name,
        source: 'api',
      };
      persistState();
      sendStateUpdate();
    }
  } catch (error) {
    state.mission = {
      text: `Error: ${error.message || String(error)}`,
      source: 'error',
    };
    sendStateUpdate();
  }
}

function startPolling() {
  clearPoll();
  if (!state.token) return;
  pollTimer = setInterval(refreshCharacterStats, 10000);
}

function startLogWatcher() {
  if (logWatcher) {
    logWatcher.stop();
    logWatcher = null;
  }
  logWatcher = new PoeLogWatcher((mission) => {
    if (mission && mission !== state.mission.text) {
      state.mission = {
        text: mission,
        source: 'log',
      };
      persistState();
      sendStateUpdate();
    }
  });
  logWatcher.start().catch(() => {});
}

function createDashboardWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 860,
    minWidth: 980,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('ready-to-show', () => win.show());
  windows.dashboard = win;
}

function createOverlayWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1200,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    focusable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'overlay', 'overlay.html'));
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  windows.overlay = win;
}

function registerIpc() {
  ipcMain.handle('app:get-state', async () => state);
  ipcMain.handle('app:set-token', async (_e, token) => {
    if (!token || typeof token !== 'string') {
      return { ok: false, error: 'Token must be a non-empty string.' };
    }
    state.token = token.trim();
    poeApi = new PoeApi(state.token);
    const result = await refreshCharacters();
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    persistState();
    startPolling();
    startLogWatcher();
    return { ok: true, state };
  });
  ipcMain.handle('app:set-account', async (_e, accountName) => {
    if (typeof accountName === 'string') {
      state.accountName = accountName;
      persistState();
      sendStateUpdate();
      return { ok: true };
    }
    return { ok: false, error: 'Invalid account name.' };
  });
  ipcMain.handle('app:refresh-characters', async () => refreshCharacters());
  ipcMain.handle('app:pick-character', async (_e, name) => {
    state.activeCharacter = name || '';
    persistState();
    sendStateUpdate();
    refreshCharacterStats();
    return { ok: true, activeCharacter: state.activeCharacter };
  });
  ipcMain.handle('app:add-guide', async (_e, payload) => {
    const parsed = parseGuidePayload(payload);
    if (!parsed.ok) return parsed;
    state.guides.push(parsed.guide);
    if (!state.selectedGuideId) {
      state.selectedGuideId = parsed.guide.id;
    }
    persistState();
    sendStateUpdate();
    return { ok: true };
  });
  ipcMain.handle('app:get-guides', async () => ({ guides: state.guides }));
  ipcMain.handle('app:select-guide', async (_e, guideId) => {
    state.selectedGuideId = guideId || '';
    persistState();
    sendStateUpdate();
    return { ok: true };
  });
  ipcMain.handle('app:open-auth', async () => {
    if (!CLIENT_ID) {
      return {
        ok: false,
        error:
          'POE_CLIENT_ID is not configured. Set POE_CLIENT_ID in environment and restart the app.',
      };
    }
    const authUrl = `https://www.pathofexile.com/oauth/authorize?client_id=${encodeURIComponent(
      CLIENT_ID
    )}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${encodeURIComponent(
      AUTH_SCOPES
    )}`;
    await shell.openExternal(authUrl);
    return { ok: true };
  });
  ipcMain.handle('overlay:update-mapping', async (_e, payload) => {
    const incoming = payload || {};
    state.overlay.visible = Boolean(
      incoming.visible !== undefined ? incoming.visible : state.overlay.visible
    );
    if (incoming.scale !== undefined) {
      const scale = Number(incoming.scale);
      if (!Number.isNaN(scale) && scale > 0) state.overlay.scale = scale;
    }
    if (incoming.offsetX !== undefined && !Number.isNaN(Number(incoming.offsetX))) {
      state.overlay.offsetX = Number(incoming.offsetX);
    }
    if (incoming.offsetY !== undefined && !Number.isNaN(Number(incoming.offsetY))) {
      state.overlay.offsetY = Number(incoming.offsetY);
    }
    if (windows.overlay && !windows.overlay.isDestroyed()) {
      windows.overlay.setIgnoreMouseEvents(state.overlay.visible, {
        forward: !state.overlay.visible,
      });
      windows.overlay.setAlwaysOnTop(state.overlay.visible, 'screen-saver');
      windows.overlay.show();
      windows.overlay.setOpacity(state.overlay.visible ? 1 : 0);
    }
    persistState();
    sendStateUpdate();
    return { ok: true, overlay: state.overlay };
  });
  ipcMain.handle('app:delete-guide', async (_e, guideId) => {
    const id = String(guideId || '').trim();
    if (!id) return { ok: false, error: 'Missing guideId.' };
    state.guides = state.guides.filter((g) => g.id !== id);
    if (state.selectedGuideId === id) {
      state.selectedGuideId = state.guides[0]?.id || '';
    }
    persistState();
    sendStateUpdate();
    return { ok: true };
  });
}

function hydrateStateFromStore() {
  const saved = store.getState();
  if (!saved) return;
  state = {
    ...state,
    ...saved,
    overlay: {
      ...state.overlay,
      ...(saved.overlay || {}),
    },
  };
  if (state.token) {
    poeApi = new PoeApi(state.token);
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  hydrateStateFromStore();
  createDashboardWindow();
  createOverlayWindow();
  registerIpc();
  if (state.token) {
    refreshCharacters().then(() => {
      startPolling();
      startLogWatcher();
      refreshCharacterStats();
      sendStateUpdate();
    });
  } else {
    sendStateUpdate();
  }
});

app.on('window-all-closed', () => {
  clearPoll();
  if (logWatcher) {
    logWatcher.stop();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

