import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';

export const VERIFY_BUTTON_ID = 'protectbot_verify';

export function buildVerificationMessage(guild) {
  const embed = new EmbedBuilder()
    .setTitle('🔐 Vérification requise')
    .setDescription(`Clique sur le bouton ci-dessous pour accéder à **${guild.name}**.`)
    .setColor(0x5865f2);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(VERIFY_BUTTON_ID).setLabel('Je ne suis pas un bot ✅').setStyle(ButtonStyle.Success)
  );
  return { embeds: [embed], components: [row] };
}

export function registerVerification(client) {
  client.on('guildMemberAdd', async (member) => {
    const cfg = store.guild(member.guild.id);
    if (!cfg.verification.enabled || !cfg.verification.unverifiedRoleId) return;
    await member.roles.add(cfg.verification.unverifiedRoleId, 'Vérification requise').catch(() => null);
  });

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== VERIFY_BUTTON_ID) return;

    const guild = interaction.guild;
    if (!guild) return;
    const cfg = store.guild(guild.id);
    const member = interaction.member;

    try {
      if (cfg.verification.unverifiedRoleId) {
        await member.roles.remove(cfg.verification.unverifiedRoleId, 'Vérifié').catch(() => null);
      }
      if (cfg.verification.memberRoleId) {
        await member.roles.add(cfg.verification.memberRoleId, 'Vérifié').catch(() => null);
      }
      await interaction.reply({ content: '✅ Tu es vérifié, bienvenue !', ephemeral: true });
      await logSecurityEvent(guild, {
        title: '✅ Membre vérifié',
        description: `<@${member.id}> a validé la vérification.`,
        level: 'success'
      });
    } catch (err) {
      await interaction.reply({ content: '❌ Une erreur est survenue pendant la vérification.', ephemeral: true }).catch(() => null);
      console.error('Erreur vérification:', err.message);
    }
  });
}
