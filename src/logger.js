import { EmbedBuilder } from 'discord.js';
import { store } from './store.js';

const COLORS = {
  info: 0x5865f2,
  warn: 0xf5a623,
  danger: 0xed4245,
  success: 0x57f287
};

export async function logSecurityEvent(guild, { title, description, level = 'warn', fields = [] }) {
  const cfg = store.guild(guild.id);
  console.log(`[${guild.name}] (${level}) ${title} - ${description}`);

  store.addIncident(guild.id, { title, description, level, fields });

  const channelId = cfg.logChannelId;
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(COLORS[level] ?? COLORS.info)
      .setTimestamp();

    if (fields.length) embed.addFields(fields);

    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Impossible d\'envoyer le log de sécurité:', err.message);
  }
}
