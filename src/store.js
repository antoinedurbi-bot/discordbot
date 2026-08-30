import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

const DEFAULTS = {
  guilds: {}
};

function guildDefaults() {
  return {
    whitelist: [],
    logChannelId: null,
    panicMode: false,
    antiNuke: {
      enabled: true,
      maxActions: 4,
      windowMs: 10_000,
      punishment: 'strip' // 'strip' | 'kick' | 'ban'
    },
    antiRaid: {
      enabled: true,
      joinThreshold: 8,
      windowMs: 10_000,
      minAccountAgeMs: 1000 * 60 * 60 * 24 * 3, // 3 jours
      lockdownOnTrigger: true
    },
    antiSpam: {
      enabled: true,
      messageThreshold: 6,
      windowMs: 7_000,
      mentionThreshold: 6,
      duplicateThreshold: 4,
      punishment: 'timeout' // 'timeout' | 'kick' | 'ban'
    },
    backups: [],
    incidents: []
  };
}

class Store {
  constructor() {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    if (!existsSync(DATA_FILE)) {
      this.data = structuredClone(DEFAULTS);
      this._save();
    } else {
      try {
        this.data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
      } catch {
        this.data = structuredClone(DEFAULTS);
      }
    }
  }

  _save() {
    writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2));
  }

  guild(guildId) {
    if (!this.data.guilds[guildId]) {
      this.data.guilds[guildId] = guildDefaults();
      this._save();
    }
    return this.data.guilds[guildId];
  }

  update(guildId, mutator) {
    const g = this.guild(guildId);
    mutator(g);
    this._save();
    return g;
  }

  addIncident(guildId, incident) {
    const g = this.guild(guildId);
    g.incidents.unshift({ ...incident, at: Date.now() });
    g.incidents = g.incidents.slice(0, 200);
    this._save();
  }

  addBackup(guildId, backup) {
    const g = this.guild(guildId);
    g.backups.unshift(backup);
    g.backups = g.backups.slice(0, 5);
    this._save();
  }
}

export const store = new Store();
