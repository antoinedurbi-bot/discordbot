import { EmbedBuilder } from 'discord.js';

export async function purgeMessages(channel, amount) {
  const deletable = Math.min(Math.max(amount, 1), 100);
  const deleted = await channel.bulkDelete(deletable, true).catch(() => null);
  return deleted?.size ?? 0;
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
