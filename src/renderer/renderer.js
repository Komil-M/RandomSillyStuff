const els = {
  tokenInput: document.getElementById('tokenInput'),
  accountInput: document.getElementById('accountInput'),
  accountStatus: document.getElementById('accountStatus'),
  accountText: document.getElementById('accountText'),
  missionText: document.getElementById('missionText'),
  characterList: document.getElementById('characterList'),
  activeCharacterText: document.getElementById('activeCharacterText'),
  activeClassText: document.getElementById('activeClassText'),
  overlaySummary: document.getElementById('overlaySummary'),
  guideTitleInput: document.getElementById('guideTitleInput'),
  guideUrlInput: document.getElementById('guideUrlInput'),
  guideTextInput: document.getElementById('guideTextInput'),
  guideList: document.getElementById('guideList'),
  overlayVisible: document.getElementById('overlayVisible'),
  overlayScale: document.getElementById('overlayScale'),
  overlayOffsetX: document.getElementById('overlayOffsetX'),
  overlayOffsetY: document.getElementById('overlayOffsetY'),
  scaleValue: document.getElementById('scaleValue'),
  events: document.getElementById('events'),
};

const state = {
  token: null,
  accountName: '',
  characters: [],
  activeCharacter: '',
  mission: { text: 'Unknown', source: 'idle' },
  guides: [],
  selectedGuideId: '',
  guideProgress: {},
  overlay: { visible: true, scale: 1, offsetX: 0, offsetY: 0 },
};

function pushEvent(message) {
  const item = document.createElement('li');
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  els.events.prepend(item);
  while (els.events.children.length > 6) {
    els.events.lastElementChild.remove();
  }
}

function renderCharacters() {
  els.characterList.innerHTML = '';
  if (!state.characters.length) {
    const li = document.createElement('li');
    li.textContent = 'No characters loaded. Paste token and refresh.';
    els.characterList.appendChild(li);
    return;
  }
  state.characters.forEach((character) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'route-row';
    const text = document.createElement('span');
    text.textContent = `${character.name} - ${character.class || 'Unknown'} L${character.level} (${character.league || 'Unknown'})`;
    if (character.name === state.activeCharacter) {
      text.className = 'active';
    }
    const btn = document.createElement('button');
    btn.textContent = character.name === state.activeCharacter ? 'Selected' : 'Select';
    btn.disabled = character.name === state.activeCharacter;
    btn.addEventListener('click', async () => {
      const res = await window.electronAPI.pickCharacter(character.name);
      if (res?.ok) {
        state.activeCharacter = character.name;
        pushEvent(`Selected character ${character.name}`);
        render();
      } else {
        pushEvent(`Failed to select character: ${res?.error || 'Unknown error'}`);
      }
    });
    row.append(text, btn);
    li.appendChild(row);
    els.characterList.appendChild(li);
  });
}

function renderGuides() {
  els.guideList.innerHTML = '';
  state.guides.forEach((guide) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'route-row';
    const nameWrap = document.createElement('div');
    const totalNodes = Number(guide.nodes?.length || 0);
    const guideProgress = Number(state.guideProgress?.[guide.id] || 0);
    const clampedProgress = Math.max(0, Math.min(totalNodes, Number.isFinite(guideProgress) ? guideProgress : 0));
    nameWrap.innerHTML = `<div>${guide.title || 'Guide'}</div><div class="guide-meta">${totalNodes} nodes | ${clampedProgress}/${totalNodes} done | ${guide.id}</div>`;
    const actions = document.createElement('div');
    const select = document.createElement('button');
    const remove = document.createElement('button');
    const next = document.createElement('button');
    const reset = document.createElement('button');
    select.textContent = guide.id === state.selectedGuideId ? 'Active' : 'Use';
    remove.textContent = 'Delete';
    next.textContent = 'Next';
    reset.textContent = 'Reset';
    select.disabled = guide.id === state.selectedGuideId;
    select.addEventListener('click', async () => {
      await window.electronAPI.selectGuide(guide.id);
      state.selectedGuideId = guide.id;
      state.guideProgress[guide.id] = Number(state.guideProgress[guide.id] || 0);
      pushEvent(`Guide selected: ${guide.title || guide.id}`);
      render();
    });
    next.disabled = clampedProgress >= totalNodes;
    next.addEventListener('click', async () => {
      const res = await window.electronAPI.advanceGuideStep(guide.id);
      if (res?.ok) {
        state.guideProgress[guide.id] = res.progress;
        pushEvent(`Guide step advanced: ${guide.title || guide.id} (${res.progress}/${totalNodes})`);
        render();
      } else {
        pushEvent(`Could not advance guide step: ${res?.error || 'Unknown'}`);
      }
    });
    reset.addEventListener('click', async () => {
      const res = await window.electronAPI.resetGuideProgress(guide.id);
      if (res?.ok) {
        state.guideProgress[guide.id] = 0;
        pushEvent(`Guide reset: ${guide.title || guide.id}`);
        render();
      } else {
        pushEvent(`Could not reset guide: ${res?.error || 'Unknown'}`);
      }
    });
    if (guide.id !== state.selectedGuideId) {
      next.style.display = 'none';
      reset.style.display = 'none';
    }
    remove.addEventListener('click', async () => {
      const res = await window.electronAPI.deleteGuide(guide.id);
      if (res?.ok) {
        if (state.selectedGuideId === guide.id) state.selectedGuideId = '';
        state.guideProgress = { ...state.guideProgress };
        delete state.guideProgress[guide.id];
        state.guides = state.guides.filter((entry) => entry.id !== guide.id);
        pushEvent(`Guide deleted: ${guide.title || guide.id}`);
        render();
      }
    });
    actions.append(select, next, reset, remove);
    row.append(nameWrap, actions);
    li.appendChild(row);
    els.guideList.appendChild(li);
  });
}

function renderSession() {
  const active = state.characters.find((c) => c.name === state.activeCharacter) || null;
  els.accountText.textContent = `Account: ${state.accountName || 'Not set'}`;
  els.missionText.textContent = `Mission: ${state.mission?.text || 'Unknown'} (${state.mission?.source || 'idle'})`;
  els.activeCharacterText.textContent = state.activeCharacter ? `Active character: ${state.activeCharacter}` : 'No character selected';
  els.activeClassText.textContent = active ? `Class: ${active.class || 'Unknown'}` : 'Class: unknown';
  els.overlaySummary.textContent = `Overlay: ${state.overlay.visible ? 'Visible' : 'Hidden'} @ scale ${state.overlay.scale.toFixed(2)} (${state.overlay.offsetX}, ${state.overlay.offsetY})`;
  els.overlayVisible.checked = state.overlay.visible;
  els.overlayScale.value = `${state.overlay.scale}`;
  els.scaleValue.textContent = Number(state.overlay.scale).toFixed(2);
  els.overlayOffsetX.value = `${state.overlay.offsetX}`;
  els.overlayOffsetY.value = `${state.overlay.offsetY}`;
}

function renderTokenFields() {
  if (state.token) {
    els.tokenInput.value = '************';
    els.accountStatus.textContent = 'Token loaded from local cache.';
  }
}

function render() {
  renderSession();
  renderCharacters();
  renderGuides();
  renderTokenFields();
}

async function refreshNow() {
  const res = await window.electronAPI.refreshCharacters();
  if (res?.ok) {
    state.characters = res.characters || [];
    pushEvent('Character list refreshed');
  } else {
    pushEvent(`Refresh failed: ${res?.error || 'Unknown'}`);
  }
  render();
}

async function syncState(initialState) {
  if (!initialState) return;
  Object.assign(state, initialState);
  if (initialState.accountName) {
    els.accountInput.value = initialState.accountName;
  }
  if (initialState.overlay) {
    Object.assign(state.overlay, initialState.overlay);
  }
  render();
}

async function init() {
  if (!window.electronAPI) {
    els.accountStatus.textContent = 'Cannot connect to Electron bridge.';
    return;
  }

  const initialState = await window.electronAPI.getState();
  await syncState(initialState || {});

  window.electronAPI.onStateUpdate((incoming) => {
    Object.assign(state, incoming);
    render();
  });

  document.getElementById('saveTokenBtn').addEventListener('click', async () => {
    const token = els.tokenInput.value.trim();
    if (!token) {
      pushEvent('Please provide a token.');
      return;
    }
    const res = await window.electronAPI.setToken(token);
    if (res?.ok) {
      state.token = token;
      state.accountName = res.state?.accountName || state.accountName;
      state.characters = res.state?.characters || [];
      if (!state.activeCharacter && state.characters[0]) {
        state.activeCharacter = state.characters[0].name;
      }
      pushEvent('Token saved and character data loaded.');
      render();
    } else {
      pushEvent(`Token save failed: ${res?.error || 'Unknown'}`);
    }
  });

  document.getElementById('setAccountBtn').addEventListener('click', async () => {
    const accountName = els.accountInput.value.trim();
    const res = await window.electronAPI.setAccount(accountName);
    if (res?.ok) {
      state.accountName = accountName;
      pushEvent(`Account set: ${accountName || '(empty)'}`);
      render();
    } else {
      pushEvent(`Could not set account: ${res?.error || 'Unknown'}`);
    }
  });

  document.getElementById('authBtn').addEventListener('click', async () => {
    const res = await window.electronAPI.openAuth();
    if (res?.ok) {
      pushEvent('OAuth page opened. Paste returned access token in token field.');
    } else {
      pushEvent(`OAuth unavailable: ${res?.error || 'Unknown'}`);
    }
  });

  document.getElementById('refreshBtn').addEventListener('click', refreshNow);

  document.getElementById('addGuideBtn').addEventListener('click', async () => {
    const payload = {
      title: els.guideTitleInput.value.trim(),
      url: els.guideUrlInput.value.trim(),
      text: els.guideTextInput.value.trim(),
    };
    const result = await window.electronAPI.addGuide(payload);
    if (result?.ok) {
      const guidesState = await window.electronAPI.getGuides();
      state.guides = guidesState?.guides || [];
      if (!state.selectedGuideId && state.guides[0]) {
        state.selectedGuideId = state.guides[0].id;
      }
      els.guideTitleInput.value = '';
      els.guideUrlInput.value = '';
      els.guideTextInput.value = '';
      pushEvent('Guide imported successfully.');
      render();
    } else {
      pushEvent(`Guide import failed: ${result?.error || 'Unknown'}`);
    }
  });

  const updateOverlay = async () => {
    const payload = {
      visible: els.overlayVisible.checked,
      scale: Number(els.overlayScale.value),
      offsetX: Number(els.overlayOffsetX.value || 0),
      offsetY: Number(els.overlayOffsetY.value || 0),
    };
    await window.electronAPI.updateOverlay(payload);
    state.overlay = { ...state.overlay, ...payload };
    renderSession();
  };

  els.overlayVisible.addEventListener('change', updateOverlay);
  els.overlayScale.addEventListener('input', (event) => {
    els.scaleValue.textContent = Number(event.target.value).toFixed(2);
    updateOverlay();
  });
  els.overlayOffsetX.addEventListener('change', updateOverlay);
  els.overlayOffsetY.addEventListener('change', updateOverlay);
}

init();
