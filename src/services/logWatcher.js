import fs from 'fs';

const DEFAULT_PATH_CANDIDATES = [
  process.env.POE_CLIENT_LOG_PATH,
  `${process.env.LOCALAPPDATA}\\Path of Exile\\logs\\Client.txt`,
  `${process.env.USERPROFILE}\\Documents\\My Games\\Path of Exile\\logs\\Client.txt`,
  `${process.env.APPDATA}\\Path of Exile\\logs\\Client.txt`,
];

const CANDIDATE_PATTERNS = [
  /You have entered (.+?)\./i,
  /Entering (.+?)\./i,
  /Area: (.+?)\./i,
  /Current area is (.+?)\./i,
  /You enter (.+?)$/i,
];

function resolveLogPath() {
  for (const candidate of DEFAULT_PATH_CANDIDATES) {
    if (!candidate) continue;
    const normalized = candidate.replace(/\//g, '\\');
    if (fs.existsSync(normalized)) return normalized;
  }
  return null;
}

export class PoeLogWatcher {
  constructor(onMission, customPath = '') {
    this.onMission = onMission;
    this.logPath = customPath || resolveLogPath();
    this.timer = null;
    this.lastSize = 0;
    this.lastMission = '';
  }

  start() {
    if (!this.logPath) {
      throw new Error('PoE log file could not be located.');
    }
    if (!fs.existsSync(this.logPath)) {
      throw new Error(`PoE log file missing at ${this.logPath}`);
    }
    const stats = fs.statSync(this.logPath);
    this.lastSize = Math.max(0, Number(stats.size || 0));
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => this.poll(), 1500);
    return Promise.resolve(true);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll() {
    if (!fs.existsSync(this.logPath)) return;
    try {
      const stats = fs.statSync(this.logPath);
      let end = Number(stats.size || 0);
      if (end < this.lastSize) {
        this.lastSize = 0;
      }
      const bytes = end - this.lastSize;
      if (bytes <= 0) return;

      const fd = fs.openSync(this.logPath, 'r');
      const buffer = Buffer.alloc(bytes);
      fs.readSync(fd, buffer, 0, bytes, this.lastSize);
      fs.closeSync(fd);
      this.lastSize = end;

      const text = buffer.toString('utf8');
      const lines = text.split(/\r?\n/);
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = lines[i];
        for (const pattern of CANDIDATE_PATTERNS) {
          const match = line.match(pattern);
          if (match && match[1]) {
            const mission = match[1].trim();
            if (mission && mission !== this.lastMission) {
              this.lastMission = mission;
              this.onMission(mission);
            }
            return;
          }
        }
      }
    } catch (error) {
      console.error('[PoeLogWatcher] poll failed', error);
    }
  }
}

