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
    antiAlt: {
      enabled: false, // opt-in : peut gêner des membres légitimes si trop strict
      minAccountAgeMs: 1000 * 60 * 60 * 24, // 1 jour
      requireAvatar: true,
      punishment: 'kick' // 'kick' | 'ban'
    },
    antiPhishing: {
      enabled: true,
      punishment: 'ban' // 'timeout' | 'kick' | 'ban'
    },
    verification: {
      enabled: false,
      channelId: null,
      unverifiedRoleId: null,
      memberRoleId: null
    },
    welcome: {
      enabled: false,
      channelId: null,
      message: 'Bienvenue {user} sur **{server}** ! 🎉',
      autoRoleId: null,
      leaveEnabled: false,
      leaveChannelId: null,
      leaveMessage: '{user} a quitté le serveur. 👋'
    },
    stats: {
      date: null,
      joins: 0,
      leaves: 0
    },
    warns: [], // { id, userId, moderatorId, reason, at }
    backups: [],
    incidents: []
  };
}

function mergeDefaults(target, defaults) {
  for (const key of Object.keys(defaults)) {
    if (target[key] === undefined) {
      target[key] = defaults[key];
    } else if (
      typeof defaults[key] === 'object' &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key]) &&
      typeof target[key] === 'object' &&
      target[key] !== null
    ) {
      mergeDefaults(target[key], defaults[key]);
    }
  }
  return target;
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
      return this.data.guilds[guildId];
    }
    const merged = mergeDefaults(this.data.guilds[guildId], guildDefaults());
    return merged;
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

  addWarn(guildId, { userId, moderatorId, reason }) {
    const g = this.guild(guildId);
    const warn = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), userId, moderatorId, reason, at: Date.now() };
    g.warns.push(warn);
    this._save();
    return warn;
  }

  getWarns(guildId, userId) {
    return this.guild(guildId).warns.filter((w) => w.userId === userId);
  }

  clearWarns(guildId, userId) {
    const g = this.guild(guildId);
    const before = g.warns.length;
    g.warns = g.warns.filter((w) => w.userId !== userId);
    this._save();
    return before - g.warns.length;
  }

  bumpStat(guildId, key) {
    const g = this.guild(guildId);
    const today = new Date().toISOString().slice(0, 10);
    if (g.stats.date !== today) {
      g.stats.date = today;
      g.stats.joins = 0;
      g.stats.leaves = 0;
    }
    g.stats[key] += 1;
    this._save();
  }
}

export const store = new Store();
