const API_BASE = 'https://api.pathofexile.com';

function requireToken() {
  throw new Error('Token is required before using PoE API endpoints.');
}

export class PoeApi {
  constructor(token) {
    this.token = token || null;
  }

  setToken(token) {
    this.token = token;
  }

  async request(path, query = {}) {
    const token = this.token;
    if (!token) requireToken();
    const url = new URL(`${API_BASE}${path}`);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
    });
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`PoE API ${path} failed (${response.status}): ${body}`);
    }
    return response.json();
  }

  async getProfile() {
    return this.request('/profile');
  }

  async getCharacters(accountName) {
    const data = await this.request('/character-window/get-characters', { accountName });
    return (data.characters || []).map((entry) => ({
      id: `${entry.name}-${entry.class}-${entry.level}`,
      name: entry.name,
      class: entry.class,
      classId: entry.classId,
      level: entry.level,
      league: entry.league,
      lastAreaChange: entry.lastAreaChange || '',
    }));
  }

  async getCharacter(accountName, character) {
    return this.request('/character-window/get-items', { accountName, character });
  }
}

