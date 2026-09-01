import { EmbedBuilder } from 'discord.js';

// Supprime des messages du salon. options: { amount } | { all: true } | { userId, amount? }
// Pagine en arrière (before) sur des lots de 100 pour couvrir *clear all et *clear @membre.
export async function purgeMessages(channel, { amount = 50, userId = null, all = false } = {}) {
  let totalDeleted = 0;
  let before;
  let remaining = all ? Infinity : amount;
  const maxIterations = 15; // garde-fou contre le rate-limit sur de très longs historiques

  for (let i = 0; i < maxIterations && remaining > 0; i += 1) {
    const fetched = await channel.messages.fetch({ limit: 100, before }).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    before = fetched.last().id;

    let candidates = [...fetched.values()];
    if (userId) candidates = candidates.filter((m) => m.author.id === userId);
    if (!all) candidates = candidates.slice(0, remaining);

    if (candidates.length) {
      const deleted = await channel.bulkDelete(candidates, true).catch(() => null);
      const count = deleted?.size ?? 0;
      totalDeleted += count;
      remaining -= count;
    }

    if (fetched.size < 100) break; // fin de l'historique du salon
  }

  return totalDeleted;
}

export function buildUserInfoEmbed(member) {
  const user = member.user;
  return new EmbedBuilder()
    .setTitle(`Profil de ${user.tag}`)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setColor(0x5865f2)
    .addFields(
      { name: 'ID', value: user.id, inline: true },
      { name: 'Bot', value: user.bot ? 'Oui' : 'Non', inline: true },
      { name: 'Compte créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, inline: false },
      {
        name: 'A rejoint le serveur le',
        value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Inconnu',
        inline: false
      },
      {
        name: `Rôles (${member.roles.cache.size - 1})`,
        value: member.roles.cache.filter((r) => r.id !== member.guild.id).map((r) => `<@&${r.id}>`).join(', ') || 'Aucun'
      }
    );
}

export function buildServerInfoEmbed(guild) {
  return new EmbedBuilder()
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ size: 256 }))
    .setColor(0x5865f2)
    .addFields(
      { name: 'ID', value: guild.id, inline: true },
      { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
      { name: 'Membres', value: `${guild.memberCount}`, inline: true },
      { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true },
      { name: 'Rôles', value: `${guild.roles.cache.size}`, inline: true },
      { name: 'Niveau de vérification', value: `${guild.verificationLevel}`, inline: true },
      { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
    );
}
