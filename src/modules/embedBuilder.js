import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { canManageBot } from '../utils/permissions.js';
import { obfuscateText } from '../utils/textObfuscate.js';

export const OPEN_EMBED_MODAL_BUTTON_ID = 'protectbot_open_embed_modal';
const EMBED_MODAL_ID = 'protectbot_embed_modal';

export function buildOpenEmbedButton() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(OPEN_EMBED_MODAL_BUTTON_ID).setLabel('📝 Créer une annonce').setStyle(ButtonStyle.Primary)
  );
  return { content: 'Clique pour composer ton annonce (titre, texte, couleur, image, footer).', components: [row] };
}

function buildEmbedModal() {
  const modal = new ModalBuilder().setCustomId(EMBED_MODAL_ID).setTitle('Créer une annonce');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('Titre')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Contenu')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(4000)
    .setRequired(true);

  const colorInput = new TextInputBuilder()
    .setCustomId('color')
    .setLabel('Couleur (hex, ex: #5865F2) — optionnel')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(7)
    .setRequired(false);

  const imageInput = new TextInputBuilder()
    .setCustomId('image')
    .setLabel('URL d\'image — optionnel')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  const footerInput = new TextInputBuilder()
    .setCustomId('footer')
    .setLabel('Footer — optionnel')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(256)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(descriptionInput),
    new ActionRowBuilder().addComponents(colorInput),
    new ActionRowBuilder().addComponents(imageInput),
    new ActionRowBuilder().addComponents(footerInput)
  );

  return modal;
}

function parseColor(raw) {
  if (!raw) return 0x5865f2;
  const hex = raw.trim().replace(/^#/, '');
  const value = parseInt(hex, 16);
  return Number.isNaN(value) ? 0x5865f2 : value;
}

export function registerEmbedBuilder(client) {
  client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === OPEN_EMBED_MODAL_BUTTON_ID) {
      if (!interaction.member || !canManageBot(interaction.member)) {
        await interaction.reply({ content: '⛔ Réservé aux administrateurs.', ephemeral: true });
        return;
      }
      await interaction.showModal(buildEmbedModal());
      return;
    }

    if (interaction.isModalSubmit() && interaction.customId === EMBED_MODAL_ID) {
      const title = interaction.fields.getTextInputValue('title');
      const description = interaction.fields.getTextInputValue('description');
      const color = interaction.fields.getTextInputValue('color');
      const image = interaction.fields.getTextInputValue('image');
      const footer = interaction.fields.getTextInputValue('footer');

      const embed = new EmbedBuilder()
        .setTitle(obfuscateText(title))
        .setDescription(obfuscateText(description))
        .setColor(parseColor(color))
        .setTimestamp();
      if (image) embed.setImage(image);
      if (footer) embed.setFooter({ text: footer });

      await interaction.channel.send({ embeds: [embed] }).catch(() => null);
      await interaction.reply({ content: '✅ Annonce envoyée.', ephemeral: true });
    }
  });
}
