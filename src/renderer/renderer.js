const els = {
  tokenInput: document.getElementById('tokenInput'),
  accountInput: document.getElementById('accountInput'),
  accountStatus: document.getElementById('accountStatus'),
  accountText: document.getElementById('accountText'),
  missionText: document.getElementById('missionText'),
  characterList: document.getElementById('characterList'),
  activeCharacterText: document.getElementById('activeCharacterText'),
  activeClassText: document.getElementById('activeClassText'),
  activeLevelText: document.getElementById('activeLevelText'),
  activeLeagueText: document.getElementById('activeLeagueText'),
  overlaySummary: document.getElementById('overlaySummary'),
  guideTitleInput: document.getElementById('guideTitleInput'),
  guideUrlInput: document.getElementById('guideUrlInput'),
  guideTextInput: document.getElementById('guideTextInput'),
  guideList: document.getElementById('guideList'),
  guideSelectedTitle: document.getElementById('guideSelectedTitle'),
  guideProgressSummary: document.getElementById('guideProgressSummary'),
  guideMeta: document.getElementById('guideMeta'),
  guideSourceLink: document.getElementById('guideSourceLink'),
  guideProgressBar: document.getElementById('guideProgressBar'),
  guideSteps: document.getElementById('guideSteps'),
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

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampProgress(total, rawProgress) {
  const safe = safeNumber(rawProgress, 0);
  if (Number.isNaN(total) || total < 0) return 0;
  return Math.max(0, Math.min(Number(total), safe));
}

function pushEvent(message) {
  const item = document.createElement('li');
  item.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  els.events.prepend(item);
  while (els.events.children.length > 7) {
    els.events.lastElementChild.remove();
  }
}

function renderCharacters() {
  els.characterList.innerHTML = '';

  if (!state.characters.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No characters loaded. Add a valid token and refresh.';
    els.characterList.appendChild(li);
    return;
  }

  state.characters.forEach((character) => {
    const li = document.createElement('li');
    const row = document.createElement('div');
    row.className = 'route-row';

    const nameWrap = document.createElement('div');
    nameWrap.innerHTML = `<div>${character.name} · ${character.class || 'Unknown'} · L${character.level || 0}</div><div class="guide-meta">${character.league || 'Unknown league'} · ID: ${character.id || 'n/a'}</div>`;

    const btn = document.createElement('button');
    const isActive = character.name === state.activeCharacter;
    btn.textContent = isActive ? 'Active' : 'Use this character';
    btn.disabled = isActive;

    if (isActive) {
      nameWrap.classList.add('guide-meta');
    }

    btn.addEventListener('click', async () => {
      const response = await window.electronAPI.pickCharacter(character.name);
      if (response?.ok) {
        state.activeCharacter = character.name;
        pushEvent(`Active character set to ${character.name}`);
        render();
      } else {
        pushEvent(`Failed to switch character: ${response?.error || 'Unknown error'}`);
      }
    });

    row.append(nameWrap, btn);
    li.appendChild(row);
    els.characterList.appendChild(li);
  });
}

function renderGuides() {
  els.guideList.innerHTML = '';

  if (!state.guides.length) {
    const empty = document.createElement('li');
    empty.className = 'muted';
    empty.textContent = 'No guides yet. Import one from URL or text on the left.';
    els.guideList.appendChild(empty);
    return;
  }

  state.guides.forEach((guide) => {
    const totalNodes = Number(guide.nodes?.length || 0);
    const guideProgress = clampProgress(totalNodes, Number(state.guideProgress?.[guide.id] || 0));
    const isSelected = guide.id === state.selectedGuideId;

    const li = document.createElement('li');
    li.className = `guide-item ${isSelected ? 'guide-item--active' : ''}`;

    const info = document.createElement('div');
    info.innerHTML = `<div><strong>${guide.title || 'Guide'}</strong></div><div class="guide-meta">${totalNodes} nodes · ${guideProgress}/${totalNodes} done · ${guide.id}</div>`;

    const actions = document.createElement('div');
    actions.className = 'actions action-row';

    const select = document.createElement('button');
    select.textContent = isSelected ? 'Current' : 'Use';
    select.disabled = isSelected;
    select.addEventListener('click', async () => {
      const response = await window.electronAPI.selectGuide(guide.id);
      if (response?.ok) {
        state.selectedGuideId = guide.id;
        state.guideProgress[guide.id] = clampProgress(totalNodes, Number(state.guideProgress?.[guide.id] || 0));
        pushEvent(`Guide selected: ${guide.title || guide.id}`);
        render();
      } else {
        pushEvent(`Could not select guide: ${response?.error || 'Unknown error'}`);
      }
    });

    const next = document.createElement('button');
    next.textContent = 'Next step';
    next.disabled = guideProgress >= totalNodes || totalNodes === 0;
    next.style.display = isSelected ? 'inline-block' : 'none';
    next.addEventListener('click', async () => {
      const response = await window.electronAPI.advanceGuideStep(guide.id);
      if (response?.ok) {
        state.guideProgress[guide.id] = response.progress;
        pushEvent(`Guide advanced: ${guide.title || guide.id} (${response.progress}/${totalNodes})`);
        render();
      } else {
        pushEvent(`Could not advance guide: ${response?.error || 'Unknown error'}`);
      }
    });

    const reset = document.createElement('button');
    reset.textContent = 'Reset';
    reset.disabled = guideProgress === 0;
    reset.style.display = isSelected ? 'inline-block' : 'none';
    reset.addEventListener('click', async () => {
      const response = await window.electronAPI.resetGuideProgress(guide.id);
      if (response?.ok) {
        state.guideProgress[guide.id] = 0;
        pushEvent(`Guide reset: ${guide.title || guide.id}`);
        render();
      } else {
        pushEvent(`Could not reset guide: ${response?.error || 'Unknown error'}`);
      }
    });

    const remove = document.createElement('button');
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      const response = await window.electronAPI.deleteGuide(guide.id);
      if (response?.ok) {
        if (state.selectedGuideId === guide.id) {
          state.selectedGuideId = '';
        }
        state.guideProgress = { ...state.guideProgress };
        delete state.guideProgress[guide.id];
        state.guides = state.guides.filter((entry) => entry.id !== guide.id);
        pushEvent(`Guide deleted: ${guide.title || guide.id}`);
        render();
      } else {
        pushEvent(`Could not delete guide: ${response?.error || 'Unknown error'}`);
      }
    });

    actions.append(select, next, reset, remove);
    li.append(info, actions);
    els.guideList.appendChild(li);
  });
}

function renderGuideSteps(guide, progress) {
  els.guideSteps.innerHTML = '';

  if (!guide) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Import a guide to expose route steps.';
    els.guideSteps.appendChild(li);
    return;
  }

  const steps = guide.nodes || [];
  if (!steps.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'Guide exists but no valid passive node IDs were parsed.';
    els.guideSteps.appendChild(li);
    return;
  }

  const sorted = [...steps].sort((a, b) => (a.order || 0) - (b.order || 0));
  sorted.forEach((node, index) => {
    const status =
      index < progress
        ? 'done'
        : index === progress
          ? 'current'
          : 'pending';

    const li = document.createElement('li');
    li.className = `step-item ${status}`;
    li.innerHTML = `<span class="step-index">${index + 1}</span><span class="step-label">Node ${node.id}</span><span class="step-status">${status}</span>`;
    els.guideSteps.appendChild(li);
  });
}

function renderGuidePanel() {
  const guide = state.guides.find((entry) => entry.id === state.selectedGuideId) || null;
  if (!guide) {
    els.guideSelectedTitle.textContent = 'No guide selected';
    els.guideProgressSummary.textContent = 'Pick a guide to view route steps.';
    els.guideMeta.textContent = 'Use the list to import/select a guide.';
    els.guideSourceLink.classList.add('hidden');
    els.guideSourceLink.removeAttribute('href');
    els.guideSourceLink.textContent = 'Open guide source';
    els.guideProgressBar.style.width = '0%';
    renderGuideSteps(null);
    return;
  }

  const totalNodes = Number(guide.nodes?.length || 0);
  const done = clampProgress(totalNodes, Number(state.guideProgress?.[guide.id] || 0));
  const percent = totalNodes ? Math.round((done / totalNodes) * 100) : 0;

  els.guideSelectedTitle.textContent = guide.title || 'Guide';
  els.guideProgressSummary.textContent = totalNodes
    ? `Progress: ${done}/${totalNodes} nodes completed (${percent}%)`
    : 'No nodes parsed from this guide';
  els.guideMeta.textContent = `${guide.source || 'manual'}${guide.url ? ' · source available' : ''}`;
  if (guide.url) {
    els.guideSourceLink.href = guide.url;
    els.guideSourceLink.classList.remove('hidden');
  } else {
    els.guideSourceLink.classList.add('hidden');
  }
  els.guideProgressBar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  renderGuideSteps(guide, done);
}

function renderSession() {
  const activeCharacter = state.characters.find((entry) => entry.name === state.activeCharacter) || null;

  els.accountText.textContent = `Account: ${state.accountName || 'Not set'}`;
  els.missionText.textContent = `Mission: ${state.mission?.text || 'Unknown'} (${state.mission?.source || 'idle'})`;
  els.activeCharacterText.textContent = state.activeCharacter ? `Active: ${state.activeCharacter}` : 'No character selected';
  els.activeClassText.textContent = activeCharacter ? `Class: ${activeCharacter.class || 'Unknown'}` : 'Class: unknown';
  els.activeLevelText.textContent = activeCharacter ? `Level: ${activeCharacter.level || '-'}` : 'Level: -';
  els.activeLeagueText.textContent = activeCharacter ? `League: ${activeCharacter.league || 'Unknown'}` : 'League: -';
  els.overlaySummary.textContent = `Overlay: ${state.overlay.visible ? 'Visible' : 'Hidden'} · scale ${safeNumber(state.overlay.scale, 1).toFixed(2)} · offset (${safeNumber(state.overlay.offsetX, 0)}, ${safeNumber(state.overlay.offsetY, 0)})`;

  els.overlayVisible.checked = Boolean(state.overlay.visible);
  els.overlayScale.value = `${safeNumber(state.overlay.scale, 1)}`;
  els.scaleValue.textContent = safeNumber(state.overlay.scale, 1).toFixed(2);
  els.overlayOffsetX.value = `${safeNumber(state.overlay.offsetX, 0)}`;
  els.overlayOffsetY.value = `${safeNumber(state.overlay.offsetY, 0)}`;
}

function render() {
  renderSession();
  renderCharacters();
  renderGuides();
  renderGuidePanel();
  renderTokenFields();
}

function renderTokenFields() {
  if (state.token) {
    els.tokenInput.value = '************';
  }
  if (state.accountName) {
    els.accountInput.value = state.accountName;
  }
}

async function refreshNow() {
  const response = await window.electronAPI.refreshCharacters();
  if (response?.ok) {
    state.characters = response.characters || [];
    pushEvent('Characters refreshed from API.');
  } else {
    pushEvent(`Refresh failed: ${response?.error || 'Unknown error'}`);
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
    els.accountStatus.textContent = 'Electron bridge not available';
    return;
  }

  const initialState = await window.electronAPI.getState();
  await syncState(initialState || {});
  els.accountStatus.textContent = initialState?.token
    ? 'Connected to local session state.'
    : 'Ready. Paste token to load characters.';

  window.electronAPI.onStateUpdate((incoming) => {
    Object.assign(state, incoming);
    render();
  });

  document.getElementById('saveTokenBtn').addEventListener('click', async () => {
    const token = els.tokenInput.value.trim();
    if (!token) {
      pushEvent('Please enter a token first.');
      return;
    }

    const response = await window.electronAPI.setToken(token);
    if (response?.ok) {
      state.token = token;
      state.accountName = response.state?.accountName || state.accountName;
      state.characters = response.state?.characters || [];
      if (!state.activeCharacter && state.characters[0]) {
        state.activeCharacter = state.characters[0].name;
      }
      els.accountStatus.textContent = 'Token saved and characters loaded.';
      pushEvent('Token saved.');
      render();
    } else {
      pushEvent(`Token save failed: ${response?.error || 'Unknown error'}`);
    }
  });

  document.getElementById('setAccountBtn').addEventListener('click', async () => {
    const accountName = els.accountInput.value.trim();
    const response = await window.electronAPI.setAccount(accountName);
    if (response?.ok) {
      state.accountName = accountName;
      els.accountStatus.textContent = 'Account updated locally.';
      pushEvent(`Account set: ${accountName || '(empty)'}`);
      render();
    } else {
      pushEvent(`Could not set account: ${response?.error || 'Unknown error'}`);
    }
  });

  document.getElementById('authBtn').addEventListener('click', async () => {
    const response = await window.electronAPI.openAuth();
    if (response?.ok) {
      pushEvent('OAuth page opened. Paste the returned token into the token box.');
    } else {
      pushEvent(`OAuth failed: ${response?.error || 'Unknown error'}`);
    }
  });

  document.getElementById('refreshBtn').addEventListener('click', refreshNow);

  document.getElementById('addGuideBtn').addEventListener('click', async () => {
    const payload = {
      title: els.guideTitleInput.value.trim(),
      url: els.guideUrlInput.value.trim(),
      text: els.guideTextInput.value.trim(),
    };

    const response = await window.electronAPI.addGuide(payload);
    if (response?.ok) {
      const guidesState = await window.electronAPI.getGuides();
      state.guides = guidesState?.guides || [];
      if (!state.selectedGuideId && state.guides[0]) {
        state.selectedGuideId = state.guides[0].id;
      }
      els.guideTitleInput.value = '';
      els.guideUrlInput.value = '';
      els.guideTextInput.value = '';
      els.accountStatus.textContent = 'Guide imported successfully.';
      pushEvent('Guide imported and available in Guide Center.');
      render();
    } else {
      pushEvent(`Guide import failed: ${response?.error || 'Unknown error'}`);
    }
  });

  const updateOverlay = async () => {
    const payload = {
      visible: els.overlayVisible.checked,
      scale: safeNumber(els.overlayScale.value, 1),
      offsetX: safeNumber(els.overlayOffsetX.value, 0),
      offsetY: safeNumber(els.overlayOffsetY.value, 0),
    };
    await window.electronAPI.updateOverlay(payload);
    state.overlay = { ...state.overlay, ...payload };
    renderSession();
  };

  els.overlayVisible.addEventListener('change', updateOverlay);
  els.overlayScale.addEventListener('input', (event) => {
    els.scaleValue.textContent = safeNumber(event.target.value, 1).toFixed(2);
    updateOverlay();
  });
  els.overlayOffsetX.addEventListener('change', updateOverlay);
  els.overlayOffsetY.addEventListener('change', updateOverlay);
}

init();
