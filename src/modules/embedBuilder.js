import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { canManageBot } from '../utils/permissions.js';
import { renderTextImage } from './embedImage.js';

export const OPEN_EMBED_MODAL_BUTTON_ID = 'protectbot_open_embed_modal';
const MODAL_ID = 'protectbot_embed_modal';

export function buildOpenEmbedButton() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(OPEN_EMBED_MODAL_BUTTON_ID).setLabel('📝 Créer un message stylé').setStyle(ButtonStyle.Primary)
  );
  return { content: 'Clique pour composer ton message (envoyé en image, texte non copiable).', components: [row] };
}

function buildModal() {
  const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Créer un message stylé');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('title').setLabel('Titre').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('text').setLabel('Texte').setStyle(TextInputStyle.Paragraph).setMaxLength(1500).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('color')
        .setLabel('Couleur (hex, ex: #FF0000) — optionnel')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(7)
        .setRequired(false)
    )
  );
  return modal;
}

export function registerEmbedBuilder(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton() && interaction.customId === OPEN_EMBED_MODAL_BUTTON_ID) {
        if (!interaction.member || !canManageBot(interaction.member)) {
          await interaction.reply({ content: '⛔ Réservé aux administrateurs.', ephemeral: true });
          return;
        }
        await interaction.showModal(buildModal());
        return;
      }

      if (interaction.isModalSubmit() && interaction.customId === MODAL_ID) {
        const title = interaction.fields.getTextInputValue('title');
        const text = interaction.fields.getTextInputValue('text');
        const color = interaction.fields.getTextInputValue('color');

        await interaction.deferReply({ ephemeral: true });
        try {
          const buffer = renderTextImage({ title, text, color });
          await interaction.channel.send({ files: [{ attachment: buffer, name: 'message.png' }] });
          await interaction.editReply('✅ Image envoyée.');
        } catch (err) {
          console.error('Erreur rendu image embed:', err);
          await interaction.editReply('❌ Échec de la génération de l\'image.');
        }
      }
    } catch (err) {
      console.error('Erreur embed builder:', err.message);
    }
  });
}
