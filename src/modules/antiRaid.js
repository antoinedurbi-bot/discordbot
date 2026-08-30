import { GuildVerificationLevel } from 'discord.js';
import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';

// Map<guildId, timestamps[]>
const joinTracker = new Map();
// Map<guildId, boolean> — évite de re-déclencher le lockdown en boucle
const lockdownActive = new Map();

function recordJoin(guildId, windowMs) {
  const now = Date.now();
  const arr = (joinTracker.get(guildId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  joinTracker.set(guildId, arr);
  return arr.length;
}

export async function lockdownGuild(guild, reason) {
  lockdownActive.set(guild.id, true);
  store.update(guild.id, (g) => {
    g.panicMode = true;
  });

  try {
    if (guild.verificationLevel !== GuildVerificationLevel.VeryHigh) {
      await guild.setVerificationLevel(GuildVerificationLevel.VeryHigh, reason).catch(() => null);
    }
  } catch {
    /* ignore */
  }

  const everyone = guild.roles.everyone;
  const channels = guild.channels.cache.filter((c) => c.permissionsFor && c.manageable !== false);

  await Promise.allSettled(
    channels.map((channel) =>
      channel.permissionOverwrites
        ?.edit(everyone, { SendMessages: false, Connect: false, AddReactions: false }, { reason })
        .catch(() => null)
    )
  );

  await logSecurityEvent(guild, {
    title: '🔒 Verrouillage du serveur activé',
    description: reason,
    level: 'danger'
  });
}

export async function unlockGuild(guild, reason = 'Levée manuelle du verrouillage') {
  lockdownActive.set(guild.id, false);
  store.update(guild.id, (g) => {
    g.panicMode = false;
  });

  const everyone = guild.roles.everyone;
  const channels = guild.channels.cache.filter((c) => c.permissionsFor && c.manageable !== false);

  await Promise.allSettled(
    channels.map((channel) =>
      channel.permissionOverwrites
        ?.edit(everyone, { SendMessages: null, Connect: null, AddReactions: null }, { reason })
        .catch(() => null)
    )
  );

  await guild.setVerificationLevel(GuildVerificationLevel.Medium, reason).catch(() => null);

  await logSecurityEvent(guild, {
    title: '🔓 Verrouillage du serveur levé',
    description: reason,
    level: 'success'
  });
}

export function registerAntiRaid(client) {
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const cfg = store.guild(guild.id);
    if (!cfg.antiRaid.enabled) return;

    const accountAge = Date.now() - member.user.createdTimestamp;
    const count = recordJoin(guild.id, cfg.antiRaid.windowMs);

    const isRaidOngoing = lockdownActive.get(guild.id) === true;

    // En pleine vague de raid : les comptes trop jeunes sont expulsés immédiatement
    if (isRaidOngoing && accountAge < cfg.antiRaid.minAccountAgeMs) {
      await member.kick('[Anti-Raid] Compte trop récent pendant une vague de raid détectée').catch(() => null);
      await logSecurityEvent(guild, {
        title: '🚫 Membre expulsé (Anti-Raid)',
        description: `<@${member.id}> expulsé — compte créé il y a moins de ${Math.round(
          cfg.antiRaid.minAccountAgeMs / 3_600_000
        )}h.`,
        level: 'warn'
      });
      return;
    }

    if (count >= cfg.antiRaid.joinThreshold && !isRaidOngoing) {
      await logSecurityEvent(guild, {
        title: '🚨 Vague de raid détectée',
        description: `${count} arrivées en moins de ${cfg.antiRaid.windowMs / 1000}s.`,
        level: 'danger'
      });

      if (cfg.antiRaid.lockdownOnTrigger) {
        await lockdownGuild(
          guild,
          `[Anti-Raid] ${count} arrivées en ${cfg.antiRaid.windowMs / 1000}s — verrouillage automatique`
        );
      }
    }
  });

  client.on('guildBanRemove', () => {}); // réservé pour extensions futures (whitelist de unban)
}

export function isGuildLockedDown(guildId) {
  return lockdownActive.get(guildId) === true;
}
