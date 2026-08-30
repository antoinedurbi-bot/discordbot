import { store } from '../store.js';

const OWNER_IDS = (process.env.OWNER_IDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export function isBotOwner(userId) {
  return OWNER_IDS.includes(userId);
}

export function isWhitelisted(guildId, userId) {
  if (isBotOwner(userId)) return true;
  const cfg = store.guild(guildId);
  return cfg.whitelist.includes(userId);
}

export function isProtectedActor(guild, userId) {
  if (isWhitelisted(guild.id, userId)) return true;
  if (userId === guild.ownerId) return true;
  if (userId === guild.client.user.id) return true;
  return false;
}

export function canManageBot(member) {
  if (isBotOwner(member.id)) return true;
  return member.permissions.has('Administrator');
}
