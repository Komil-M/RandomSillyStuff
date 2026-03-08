import fs from 'fs';
import path from 'path';

export class ConfigStore {
  constructor(filePath) {
    this.filePath = path.resolve(filePath);
  }

  getState() {
    try {
      if (!fs.existsSync(this.filePath)) return null;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      console.error('[ConfigStore] failed to read state', error);
      return null;
    }
  }

  setState(state) {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (error) {
      console.error('[ConfigStore] failed to write state', error);
    }
  }
}

