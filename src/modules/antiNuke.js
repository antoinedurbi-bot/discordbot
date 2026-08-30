import { AuditLogEvent, PermissionsBitField } from 'discord.js';
import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';
import { isProtectedActor } from '../utils/permissions.js';

// Suivi en mémoire des actions destructrices par exécutant : Map<guildId, Map<userId, timestamps[]>>
const offenseTracker = new Map();

const TRACKED_ACTIONS = new Set([
  AuditLogEvent.ChannelDelete,
  AuditLogEvent.ChannelCreate,
  AuditLogEvent.RoleDelete,
  AuditLogEvent.RoleCreate,
  AuditLogEvent.RoleUpdate,
  AuditLogEvent.MemberBanAdd,
  AuditLogEvent.MemberKick,
  AuditLogEvent.WebhookCreate,
  AuditLogEvent.BotAdd,
  AuditLogEvent.MemberRoleUpdate
]);

function getTracker(guildId) {
  if (!offenseTracker.has(guildId)) offenseTracker.set(guildId, new Map());
  return offenseTracker.get(guildId);
}

function recordOffense(guildId, userId, windowMs) {
  const tracker = getTracker(guildId);
  const now = Date.now();
  const arr = (tracker.get(userId) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  tracker.set(userId, arr);
  return arr.length;
}

async function fetchLastAuditEntry(guild, type) {
  try {
    const logs = await guild.fetchAuditLogs({ type, limit: 1 });
    const entry = logs.entries.first();
    if (!entry) return null;
    // Ignorer les entrées trop anciennes (> 5s) pour éviter les faux positifs sur des events retardés
    if (Date.now() - entry.createdTimestamp > 8000) return null;
    return entry;
  } catch {
    return null;
  }
}

async function punishExecutor(guild, executorId, reason) {
  const cfg = store.guild(guild.id);
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return;

  const punishment = cfg.antiNuke.punishment;

  try {
    if (punishment === 'ban') {
      await guild.bans.create(executorId, { reason: `[Anti-Nuke] ${reason}` });
    } else if (punishment === 'kick') {
      await member.kick(`[Anti-Nuke] ${reason}`);
    } else {
      // 'strip' : retire tous les rôles porteurs de permissions dangereuses
      const dangerousPerms = [
        PermissionsBitField.Flags.Administrator,
        PermissionsBitField.Flags.ManageGuild,
        PermissionsBitField.Flags.ManageRoles,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ManageWebhooks,
        PermissionsBitField.Flags.BanMembers,
        PermissionsBitField.Flags.KickMembers
      ];
      const rolesToRemove = member.roles.cache.filter(
        (role) => role.id !== guild.id && role.permissions.any(dangerousPerms)
      );
      if (rolesToRemove.size) {
        await member.roles.remove(rolesToRemove, `[Anti-Nuke] ${reason}`);
      }
    }
  } catch (err) {
    console.error('Échec de la sanction anti-nuke:', err.message);
  }
}

async function handleTrackedAction(guild, type, label) {
  const cfg = store.guild(guild.id);
  if (!cfg.antiNuke.enabled) return;

  const entry = await fetchLastAuditEntry(guild, type);
  if (!entry || !entry.executor) return;
  if (entry.executor.bot && entry.executor.id === guild.client.user.id) return;
  if (isProtectedActor(guild, entry.executor.id)) return;

  const count = recordOffense(guild.id, entry.executor.id, cfg.antiNuke.windowMs);

  if (count >= cfg.antiNuke.maxActions) {
    await punishExecutor(
      guild,
      entry.executor.id,
      `${count} actions destructrices (${label}) en moins de ${cfg.antiNuke.windowMs / 1000}s`
    );
    getTracker(guild.id).set(entry.executor.id, []);

    await logSecurityEvent(guild, {
      title: '🛡️ Anti-Nuke déclenché',
      description: `<@${entry.executor.id}> a été sanctionné (**${cfg.antiNuke.punishment}**) pour activité destructrice suspecte.`,
      level: 'danger',
      fields: [
        { name: 'Action détectée', value: label, inline: true },
        { name: 'Occurrences', value: `${count}`, inline: true }
      ]
    });
  } else {
    await logSecurityEvent(guild, {
      title: '⚠️ Action sensible détectée',
      description: `<@${entry.executor.id}> a effectué : **${label}**`,
      level: 'warn',
      fields: [{ name: 'Compteur', value: `${count}/${cfg.antiNuke.maxActions}`, inline: true }]
    });
  }
}

export function registerAntiNuke(client) {
  client.on('channelDelete', (channel) => {
    if (channel.guild) handleTrackedAction(channel.guild, AuditLogEvent.ChannelDelete, 'Suppression de salon');
  });

  client.on('channelCreate', (channel) => {
    if (channel.guild) handleTrackedAction(channel.guild, AuditLogEvent.ChannelCreate, 'Création de salon');
  });

  client.on('roleDelete', (role) => {
    handleTrackedAction(role.guild, AuditLogEvent.RoleDelete, 'Suppression de rôle');
  });

  client.on('roleCreate', (role) => {
    handleTrackedAction(role.guild, AuditLogEvent.RoleCreate, 'Création de rôle');
  });

  client.on('guildBanAdd', (ban) => {
    handleTrackedAction(ban.guild, AuditLogEvent.MemberBanAdd, 'Bannissement de membre');
  });

  client.on('webhookUpdate', (channel) => {
    handleTrackedAction(channel.guild, AuditLogEvent.WebhookCreate, 'Création/modification de webhook');
  });

  client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) {
      await handleTrackedAction(member.guild, AuditLogEvent.BotAdd, 'Ajout de bot');
    }
  });

  client.on('guildMemberUpdate', (oldMember, newMember) => {
    const gainedRole = newMember.roles.cache.some(
      (r) => !oldMember.roles.cache.has(r.id) && r.permissions.has(PermissionsBitField.Flags.Administrator)
    );
    if (gainedRole) {
      handleTrackedAction(newMember.guild, AuditLogEvent.MemberRoleUpdate, 'Attribution d\'un rôle Administrateur');
    }
  });

  client.on('guildMemberRemove', async (member) => {
    const entry = await fetchLastAuditEntry(member.guild, AuditLogEvent.MemberKick);
    if (entry && entry.target?.id === member.id) {
      await handleTrackedAction(member.guild, AuditLogEvent.MemberKick, 'Expulsion de membre');
    }
  });
}
