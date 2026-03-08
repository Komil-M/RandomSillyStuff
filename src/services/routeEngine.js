import crypto from 'crypto';

const NODE_RE = /\b\d{3,6}\b/g;
const KEY_RE = /(?:^|\s)[nN]ode\w*[:\-\s]+([0-9]{3,6})(?:\b|$)/g;

const toNodeId = (rawId) => {
  const id = Number.parseInt(String(rawId), 10);
  if (!Number.isFinite(id) || id <= 0) return null;
  return String(id);
};

function parseNodeText(text) {
  const matches = [];
  const add = (value) => {
    const nodeId = toNodeId(value);
    if (nodeId) {
      matches.push(nodeId);
    }
  };

  for (const match of text.matchAll(KEY_RE)) {
    add(match[1]);
  }
  for (const match of text.matchAll(NODE_RE)) {
    add(match[0]);
  }

  return [...new Set(matches)];
}

function parseUrl(urlLike) {
  if (!urlLike || typeof urlLike !== 'string') return [];
  try {
    const url = new URL(urlLike);
    const list = [];
    const get = (name) => {
      const raw = url.searchParams.get(name);
      if (!raw) return [];
      return raw
        .split(/[,\s;|]/)
        .map((entry) => toNodeId(entry.trim()))
        .filter(Boolean);
    };
    const flat = [
      ...get('nodes'),
      ...get('node'),
      ...get('path'),
      ...url.pathname
        .split('/')
        .map((entry) => entry.trim())
        .flatMap((entry) => entry.split('-'))
        .map((entry) => toNodeId(entry))
        .filter(Boolean),
    ];
    return [...new Set(flat)];
  } catch {
    return [];
  }
}

function parseNodeArray(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => {
      if (typeof value === 'number' || typeof value === 'string') return toNodeId(value);
      return null;
    })
    .filter(Boolean);
}

function normalizeGuidePayload(raw) {
  if (typeof raw === 'string') {
    return {
      title: raw.trim().slice(0, 100) || 'Imported Guide',
      text: raw,
      url: '',
      nodes: [],
    };
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return {
    title: typeof raw.title === 'string' ? raw.title.trim() : 'Imported Guide',
    url: typeof raw.url === 'string' ? raw.url.trim() : '',
    text: typeof raw.text === 'string' ? raw.text.trim() : '',
    nodes: raw.nodes || [],
    source: raw.source || '',
  };
}

export function parseGuidePayload(payload) {
  const guide = normalizeGuidePayload(payload);
  if (!guide) {
    return { ok: false, error: 'Guide payload must be text or object.' };
  }

  const fromText = typeof guide.text === 'string' ? parseNodeText(guide.text) : [];
  const fromUrl = parseUrl(guide.url);
  const fromNodes = parseNodeArray(guide.nodes);
  const rawIds = [...new Set([...fromNodes, ...fromUrl, ...fromText])];

  if (!rawIds.length) {
    return {
      ok: false,
      error:
        'No passive nodes were detected. Include node IDs in the URL query (nodes=12345,67890) or paste raw node IDs.',
    };
  }

  const uniqueNodes = rawIds.map((id) => ({ id, order: rawIds.indexOf(id) }));
  const normalized = uniqueNodes
    .map((item) => ({
      id: item.id,
      order: item.order,
      title: `${item.id}`,
    }))
    .sort((a, b) => a.order - b.order);

  return {
    ok: true,
    guide: {
      id: `guide_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      title: guide.title,
      source: guide.source || (guide.url ? 'url' : 'text'),
      url: guide.url,
      nodes: normalized,
      createdAt: new Date().toISOString(),
    },
  };
}

