import { store } from '../store.js';

export async function createBackup(guild) {
  const roles = guild.roles.cache
    .filter((r) => r.id !== guild.id)
    .map((r) => ({
      name: r.name,
      color: r.color,
      hoist: r.hoist,
      permissions: r.permissions.bitfield.toString(),
      mentionable: r.mentionable,
      position: r.position
    }));

  const channels = guild.channels.cache.map((c) => ({
    name: c.name,
    type: c.type,
    parentId: c.parentId,
    position: c.position
  }));

  const backup = {
    createdAt: Date.now(),
    roles,
    channels
  };

  store.addBackup(guild.id, backup);
  return backup;
}

export function listBackups(guildId) {
  return store.guild(guildId).backups;
}

export async function restoreRoles(guild, backup) {
  let restored = 0;
  for (const role of backup.roles) {
    const exists = guild.roles.cache.find((r) => r.name === role.name);
    if (exists) continue;
    try {
      await guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        mentionable: role.mentionable,
        permissions: BigInt(role.permissions),
        reason: 'Restauration après incident de sécurité'
      });
      restored += 1;
    } catch {
      /* ignore un rôle qui échoue, continue les autres */
    }
  }
  return restored;
}
