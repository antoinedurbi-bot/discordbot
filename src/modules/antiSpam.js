import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';
import { isProtectedActor } from '../utils/permissions.js';

// Map<guildId, Map<userId, { timestamps: number[], lastContent: string, dupCount: number }>>
const messageTracker = new Map();

const INVITE_REGEX = /(discord\.gg|discord(?:app)?\.com\/invite)\/\S+/i;

function getUserState(guildId, userId) {
  if (!messageTracker.has(guildId)) messageTracker.set(guildId, new Map());
  const guildMap = messageTracker.get(guildId);
  if (!guildMap.has(userId)) guildMap.set(userId, { timestamps: [], lastContent: '', dupCount: 0 });
  return guildMap.get(userId);
}

async function punish(member, cfg, reason) {
  try {
    if (cfg.antiSpam.punishment === 'ban') {
      await member.ban({ reason: `[Anti-Spam] ${reason}` });
    } else if (cfg.antiSpam.punishment === 'kick') {
      await member.kick(`[Anti-Spam] ${reason}`);
    } else {
      await member.timeout(10 * 60 * 1000, `[Anti-Spam] ${reason}`);
    }
  } catch (err) {
    console.error('Échec de la sanction anti-spam:', err.message);
  }
}

export function registerAntiSpam(client) {
  client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const cfg = store.guild(guild.id);
    if (!cfg.antiSpam.enabled) return;
    if (isProtectedActor(guild, message.author.id)) return;

    const member = message.member;
    if (!member) return;

    const state = getUserState(guild.id, message.author.id);
    const now = Date.now();

    state.timestamps = state.timestamps.filter((t) => now - t < cfg.antiSpam.windowMs);
    state.timestamps.push(now);

    if (message.content && message.content === state.lastContent) {
      state.dupCount += 1;
    } else {
      state.dupCount = 0;
      state.lastContent = message.content ?? '';
    }

    const mentionCount = message.mentions.users.size + message.mentions.roles.size;
    const hasInvite = INVITE_REGEX.test(message.content ?? '');

    let reason = null;
    if (state.timestamps.length >= cfg.antiSpam.messageThreshold) {
      reason = `flood de messages (${state.timestamps.length} en ${cfg.antiSpam.windowMs / 1000}s)`;
    } else if (mentionCount >= cfg.antiSpam.mentionThreshold) {
      reason = `spam de mentions (${mentionCount} mentions)`;
    } else if (state.dupCount >= cfg.antiSpam.duplicateThreshold) {
      reason = `messages dupliqués (${state.dupCount + 1}x)`;
    } else if (hasInvite && !member.permissions.has('ManageGuild')) {
      reason = 'partage de lien d\'invitation non autorisé';
    }

    if (reason) {
      await message.delete().catch(() => null);
      await punish(member, cfg, reason);
      state.timestamps = [];
      state.dupCount = 0;

      await logSecurityEvent(guild, {
        title: '🧹 Anti-Spam déclenché',
        description: `<@${message.author.id}> sanctionné (**${cfg.antiSpam.punishment}**) : ${reason}`,
        level: 'warn'
      });
    }
  });
}
