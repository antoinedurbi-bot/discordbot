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

export const OPEN_EMBED_MODAL_BUTTON_ID = 'protectbot_open_embed_modal';

const MODAL_BASIC = 'protectbot_embed_basic';
const MODAL_MEDIA = 'protectbot_embed_media';
const MODAL_AUTHOR_FOOTER = 'protectbot_embed_authorfooter';
const MODAL_FIELD = 'protectbot_embed_field';

const BTN_EDIT_BASIC = 'protectbot_edit_basic';
const BTN_EDIT_MEDIA = 'protectbot_edit_media';
const BTN_EDIT_AUTHORFOOTER = 'protectbot_edit_authorfooter';
const BTN_ADD_FIELD = 'protectbot_add_field';
const BTN_CLEAR_FIELDS = 'protectbot_clear_fields';
const BTN_SEND = 'protectbot_send_embed';
const BTN_CANCEL = 'protectbot_cancel_embed';

const MAX_FIELDS = 10;

// Brouillon en cours d'édition, gardé en mémoire le temps de la session de composition.
// Clé = ID du message d'aperçu (éphémère).
const drafts = new Map();

function newDraft() {
  return {
    title: 'Titre du message',
    description: 'Décris ton message ici.',
    color: '#5865F2',
    image: '',
    thumbnail: '',
    authorName: '',
    authorIcon: '',
    footerText: '',
    footerIcon: '',
    fields: []
  };
}

function parseColor(raw) {
  if (!raw) return 0x5865f2;
  const hex = raw.trim().replace(/^#/, '');
  const value = parseInt(hex, 16);
  return Number.isNaN(value) ? 0x5865f2 : value;
}

function buildPreviewEmbed(draft) {
  const embed = new EmbedBuilder()
    .setTitle(draft.title || null)
    .setDescription(draft.description || null)
    .setColor(parseColor(draft.color));

  if (draft.image) embed.setImage(draft.image);
  if (draft.thumbnail) embed.setThumbnail(draft.thumbnail);
  if (draft.authorName) embed.setAuthor({ name: draft.authorName, iconURL: draft.authorIcon || undefined });
  if (draft.footerText) embed.setFooter({ text: draft.footerText, iconURL: draft.footerIcon || undefined });
  if (draft.fields.length) embed.addFields(draft.fields);

  return embed;
}

function buildPreviewRows(draft) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BTN_EDIT_BASIC).setLabel('✏️ Titre & Texte').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BTN_EDIT_MEDIA).setLabel('🖼️ Couleur & Images').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(BTN_EDIT_AUTHORFOOTER).setLabel('👤 Auteur & Footer').setStyle(ButtonStyle.Secondary)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BTN_ADD_FIELD)
      .setLabel(`➕ Ajouter un champ (${draft.fields.length}/${MAX_FIELDS})`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(draft.fields.length >= MAX_FIELDS),
    new ButtonBuilder().setCustomId(BTN_CLEAR_FIELDS).setLabel('🗑️ Vider les champs').setStyle(ButtonStyle.Secondary).setDisabled(!draft.fields.length)
  );
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(BTN_SEND).setLabel('📤 Envoyer').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(BTN_CANCEL).setLabel('Annuler').setStyle(ButtonStyle.Danger)
  );
  return [row1, row2, row3];
}

export function buildOpenEmbedButton() {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(OPEN_EMBED_MODAL_BUTTON_ID).setLabel('📝 Créer un message stylé').setStyle(ButtonStyle.Primary)
  );
  return { content: 'Clique pour composer ton message (titre, couleur, images, auteur, champs personnalisés...).', components: [row] };
}

function textInput(customId, label, style, value, options = {}) {
  const input = new TextInputBuilder().setCustomId(customId).setLabel(label).setStyle(style).setRequired(options.required ?? false);
  if (options.maxLength) input.setMaxLength(options.maxLength);
  if (value) input.setValue(value);
  return input;
}

function buildBasicModal(draft) {
  const modal = new ModalBuilder().setCustomId(MODAL_BASIC).setTitle('Titre & Texte');
  modal.addComponents(
    new ActionRowBuilder().addComponents(textInput('title', 'Titre', TextInputStyle.Short, draft.title, { maxLength: 256, required: true })),
    new ActionRowBuilder().addComponents(
      textInput('description', 'Contenu', TextInputStyle.Paragraph, draft.description, { maxLength: 4000, required: true })
    )
  );
  return modal;
}

function buildMediaModal(draft) {
  const modal = new ModalBuilder().setCustomId(MODAL_MEDIA).setTitle('Couleur & Images');
  modal.addComponents(
    new ActionRowBuilder().addComponents(textInput('color', 'Couleur (hex, ex: #FF0000)', TextInputStyle.Short, draft.color, { maxLength: 7 })),
    new ActionRowBuilder().addComponents(textInput('image', 'URL image (grande, en bas)', TextInputStyle.Short, draft.image)),
    new ActionRowBuilder().addComponents(textInput('thumbnail', 'URL miniature (petite, en haut à droite)', TextInputStyle.Short, draft.thumbnail))
  );
  return modal;
}

function buildAuthorFooterModal(draft) {
  const modal = new ModalBuilder().setCustomId(MODAL_AUTHOR_FOOTER).setTitle('Auteur & Footer');
  modal.addComponents(
    new ActionRowBuilder().addComponents(textInput('authorName', 'Nom de l\'auteur (en haut)', TextInputStyle.Short, draft.authorName, { maxLength: 256 })),
    new ActionRowBuilder().addComponents(textInput('authorIcon', 'URL icône de l\'auteur', TextInputStyle.Short, draft.authorIcon)),
    new ActionRowBuilder().addComponents(textInput('footerText', 'Texte du footer (en bas)', TextInputStyle.Short, draft.footerText, { maxLength: 256 })),
    new ActionRowBuilder().addComponents(textInput('footerIcon', 'URL icône du footer', TextInputStyle.Short, draft.footerIcon))
  );
  return modal;
}

function buildFieldModal() {
  const modal = new ModalBuilder().setCustomId(MODAL_FIELD).setTitle('Ajouter un champ');
  modal.addComponents(
    new ActionRowBuilder().addComponents(textInput('name', 'Nom du champ', TextInputStyle.Short, '', { maxLength: 256, required: true })),
    new ActionRowBuilder().addComponents(textInput('value', 'Valeur du champ', TextInputStyle.Paragraph, '', { maxLength: 1024, required: true })),
    new ActionRowBuilder().addComponents(textInput('inline', 'Sur la même ligne ? (oui/non)', TextInputStyle.Short, 'non', { maxLength: 3 }))
  );
  return modal;
}

async function refreshPreview(interaction, draft) {
  await interaction.update({ embeds: [buildPreviewEmbed(draft)], components: buildPreviewRows(draft) });
}

export function registerEmbedBuilder(client) {
  client.on('interactionCreate', async (interaction) => {
    try {
      // Bouton initial : lance le premier modal
      if (interaction.isButton() && interaction.customId === OPEN_EMBED_MODAL_BUTTON_ID) {
        if (!interaction.member || !canManageBot(interaction.member)) {
          await interaction.reply({ content: '⛔ Réservé aux administrateurs.', ephemeral: true });
          return;
        }
        await interaction.showModal(buildBasicModal(newDraft()));
        return;
      }

      // Premier modal soumis : crée le brouillon et affiche l'aperçu éditable
      if (interaction.isModalSubmit() && interaction.customId === MODAL_BASIC && !drafts.has(interaction.message?.id)) {
        const draft = newDraft();
        draft.title = interaction.fields.getTextInputValue('title');
        draft.description = interaction.fields.getTextInputValue('description');

        await interaction.reply({ embeds: [buildPreviewEmbed(draft)], components: buildPreviewRows(draft), ephemeral: true });
        const reply = await interaction.fetchReply();
        drafts.set(reply.id, draft);
        return;
      }

      // Boutons de l'aperçu
      if (interaction.isButton() && interaction.message && drafts.has(interaction.message.id)) {
        const draft = drafts.get(interaction.message.id);

        if (interaction.customId === BTN_EDIT_BASIC) {
          await interaction.showModal(buildBasicModal(draft));
          return;
        }
        if (interaction.customId === BTN_EDIT_MEDIA) {
          await interaction.showModal(buildMediaModal(draft));
          return;
        }
        if (interaction.customId === BTN_EDIT_AUTHORFOOTER) {
          await interaction.showModal(buildAuthorFooterModal(draft));
          return;
        }
        if (interaction.customId === BTN_ADD_FIELD) {
          if (draft.fields.length >= MAX_FIELDS) {
            await interaction.reply({ content: `❌ Maximum ${MAX_FIELDS} champs atteint.`, ephemeral: true });
            return;
          }
          await interaction.showModal(buildFieldModal());
          return;
        }
        if (interaction.customId === BTN_CLEAR_FIELDS) {
          draft.fields = [];
          await refreshPreview(interaction, draft);
          return;
        }
        if (interaction.customId === BTN_SEND) {
          await interaction.channel.send({ embeds: [buildPreviewEmbed(draft)] }).catch(() => null);
          await interaction.update({ content: '✅ Message envoyé.', embeds: [], components: [] });
          drafts.delete(interaction.message.id);
          return;
        }
        if (interaction.customId === BTN_CANCEL) {
          await interaction.update({ content: '❌ Composition annulée.', embeds: [], components: [] });
          drafts.delete(interaction.message.id);
          return;
        }
      }

      // Modals de mise à jour (déclenchés depuis un bouton de l'aperçu -> interaction.message existe déjà)
      if (interaction.isModalSubmit() && interaction.message && drafts.has(interaction.message.id)) {
        const draft = drafts.get(interaction.message.id);

        if (interaction.customId === MODAL_BASIC) {
          draft.title = interaction.fields.getTextInputValue('title');
          draft.description = interaction.fields.getTextInputValue('description');
        } else if (interaction.customId === MODAL_MEDIA) {
          draft.color = interaction.fields.getTextInputValue('color');
          draft.image = interaction.fields.getTextInputValue('image');
          draft.thumbnail = interaction.fields.getTextInputValue('thumbnail');
        } else if (interaction.customId === MODAL_AUTHOR_FOOTER) {
          draft.authorName = interaction.fields.getTextInputValue('authorName');
          draft.authorIcon = interaction.fields.getTextInputValue('authorIcon');
          draft.footerText = interaction.fields.getTextInputValue('footerText');
          draft.footerIcon = interaction.fields.getTextInputValue('footerIcon');
        } else if (interaction.customId === MODAL_FIELD) {
          const name = interaction.fields.getTextInputValue('name');
          const value = interaction.fields.getTextInputValue('value');
          const inline = interaction.fields.getTextInputValue('inline').trim().toLowerCase().startsWith('o');
          if (draft.fields.length < MAX_FIELDS) draft.fields.push({ name, value, inline });
        }

        await refreshPreview(interaction, draft);
      }
    } catch (err) {
      console.error('Erreur embed builder:', err.message);
    }
  });
}
