import { EmbedBuilder } from 'discord.js';
import { store } from '../store.js';

function formatMessage(template, member) {
  return template.replace(/{user}/g, `<@${member.id}>`).replace(/{server}/g, member.guild.name);
}

export function registerWelcome(client) {
  client.on('guildMemberAdd', async (member) => {
    store.bumpStat(member.guild.id, 'joins');

    const cfg = store.guild(member.guild.id);

    if (cfg.welcome.autoRoleId) {
      await member.roles.add(cfg.welcome.autoRoleId, 'Auto-role à l\'arrivée').catch(() => null);
    }

    if (!cfg.welcome.enabled || !cfg.welcome.channelId) return;
    const channel = await member.guild.channels.fetch(cfg.welcome.channelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setDescription(formatMessage(cfg.welcome.message, member))
      .setColor(0x57f287)
      .setThumbnail(member.user.displayAvatarURL());
    await channel.send({ embeds: [embed] }).catch(() => null);
  });

  client.on('guildMemberRemove', async (member) => {
    store.bumpStat(member.guild.id, 'leaves');

    const cfg = store.guild(member.guild.id);
    if (!cfg.welcome.leaveEnabled || !cfg.welcome.leaveChannelId) return;
    const channel = await member.guild.channels.fetch(cfg.welcome.leaveChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setDescription(formatMessage(cfg.welcome.leaveMessage, member))
      .setColor(0xed4245)
      .setThumbnail(member.user.displayAvatarURL());
    await channel.send({ embeds: [embed] }).catch(() => null);
  });
}
