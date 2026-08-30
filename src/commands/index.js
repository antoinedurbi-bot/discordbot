import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { store } from '../store.js';
import { lockdownGuild, unlockGuild } from '../modules/antiRaid.js';
import { createBackup, listBackups, restoreRoles } from '../modules/backup.js';
import { canManageBot } from '../utils/permissions.js';
import { logSecurityEvent } from '../logger.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('panic')
    .setDescription('Verrouille immédiatement tout le serveur (anti-raid d\'urgence)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Lève le verrouillage d\'urgence du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Affiche l\'état de protection du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Gère la liste des membres protégés (exempts de l\'anti-nuke)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Ajoute un membre à la whitelist')
        .addUserOption((opt) => opt.setName('membre').setDescription('Membre à protéger').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Retire un membre de la whitelist')
        .addUserOption((opt) => opt.setName('membre').setDescription('Membre à retirer').setRequired(true))
    )
    .addSubcommand((sub) => sub.setName('list').setDescription('Liste les membres protégés')),

  new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Définit le salon des alertes de sécurité')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((opt) => opt.setName('salon').setDescription('Salon de logs').setRequired(true)),

  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure les seuils de protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('antinuke')
        .setDescription('Configure l\'anti-nuke')
        .addIntegerOption((o) => o.setName('max_actions').setDescription('Actions max avant sanction').setMinValue(1))
        .addIntegerOption((o) => o.setName('fenetre_s').setDescription('Fenêtre de détection (secondes)').setMinValue(2))
        .addStringOption((o) =>
          o
            .setName('sanction')
            .setDescription('Sanction appliquée')
            .addChoices({ name: 'Retrait des rôles', value: 'strip' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('antiraid')
        .setDescription('Configure l\'anti-raid')
        .addIntegerOption((o) => o.setName('seuil_arrivees').setDescription('Nombre d\'arrivées suspectes').setMinValue(2))
        .addIntegerOption((o) => o.setName('fenetre_s').setDescription('Fenêtre de détection (secondes)').setMinValue(2))
    )
    .addSubcommand((sub) =>
      sub
        .setName('antispam')
        .setDescription('Configure l\'anti-spam')
        .addIntegerOption((o) => o.setName('messages_max').setDescription('Messages max dans la fenêtre').setMinValue(2))
        .addIntegerOption((o) => o.setName('fenetre_s').setDescription('Fenêtre de détection (secondes)').setMinValue(2))
        .addStringOption((o) =>
          o
            .setName('sanction')
            .setDescription('Sanction appliquée')
            .addChoices({ name: 'Timeout 10 min', value: 'timeout' }, { name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })
        )
    ),

  new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Sauvegarde la structure actuelle (rôles/salons) du serveur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName('restore')
    .setDescription('Restaure les rôles manquants depuis la dernière sauvegarde')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
].map((c) => c.toJSON());

export async function handleInteraction(interaction) {
  if (!interaction.isChatInputCommand()) return;
  const { guild, member, commandName } = interaction;
  if (!guild || !member) return;

  if (!canManageBot(member)) {
    await interaction.reply({ content: '⛔ Tu n\'as pas la permission d\'utiliser cette commande.', ephemeral: true });
    return;
  }

  switch (commandName) {
    case 'panic': {
      await interaction.deferReply({ ephemeral: true });
      await lockdownGuild(guild, `Verrouillage manuel déclenché par ${interaction.user.tag}`);
      await interaction.editReply('🔒 Serveur verrouillé. Utilise `/unlock` pour lever la protection.');
      break;
    }

    case 'unlock': {
      await interaction.deferReply({ ephemeral: true });
      await unlockGuild(guild, `Levée manuelle par ${interaction.user.tag}`);
      await interaction.editReply('🔓 Verrouillage levé.');
      break;
    }

    case 'status': {
      const cfg = store.guild(guild.id);
      await interaction.reply({
        ephemeral: true,
        content: [
          `**État de protection — ${guild.name}**`,
          `Mode panique: ${cfg.panicMode ? '🔴 ACTIF' : '🟢 inactif'}`,
          `Anti-Nuke: ${cfg.antiNuke.enabled ? 'activé' : 'désactivé'} (max ${cfg.antiNuke.maxActions} actions / ${cfg.antiNuke.windowMs / 1000}s, sanction: ${cfg.antiNuke.punishment})`,
          `Anti-Raid: ${cfg.antiRaid.enabled ? 'activé' : 'désactivé'} (seuil ${cfg.antiRaid.joinThreshold} arrivées / ${cfg.antiRaid.windowMs / 1000}s)`,
          `Anti-Spam: ${cfg.antiSpam.enabled ? 'activé' : 'désactivé'} (max ${cfg.antiSpam.messageThreshold} msg / ${cfg.antiSpam.windowMs / 1000}s, sanction: ${cfg.antiSpam.punishment})`,
          `Whitelist: ${cfg.whitelist.length} membre(s)`,
          `Salon de logs: ${cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'non défini'}`
        ].join('\n')
      });
      break;
    }

    case 'whitelist': {
      const sub = interaction.options.getSubcommand();
      if (sub === 'list') {
        const cfg = store.guild(guild.id);
        await interaction.reply({
          ephemeral: true,
          content: cfg.whitelist.length ? cfg.whitelist.map((id) => `<@${id}>`).join('\n') : 'Whitelist vide.'
        });
        break;
      }
      const target = interaction.options.getUser('membre', true);
      store.update(guild.id, (g) => {
        if (sub === 'add') {
          if (!g.whitelist.includes(target.id)) g.whitelist.push(target.id);
        } else {
          g.whitelist = g.whitelist.filter((id) => id !== target.id);
        }
      });
      await interaction.reply({
        ephemeral: true,
        content: sub === 'add' ? `✅ <@${target.id}> ajouté à la whitelist.` : `✅ <@${target.id}> retiré de la whitelist.`
      });
      break;
    }

    case 'setlogchannel': {
      const channel = interaction.options.getChannel('salon', true);
      store.update(guild.id, (g) => {
        g.logChannelId = channel.id;
      });
      await interaction.reply({ ephemeral: true, content: `✅ Salon de logs défini sur <#${channel.id}>.` });
      break;
    }

    case 'config': {
      const sub = interaction.options.getSubcommand();
      store.update(guild.id, (g) => {
        if (sub === 'antinuke') {
          const maxActions = interaction.options.getInteger('max_actions');
          const fenetre = interaction.options.getInteger('fenetre_s');
          const sanction = interaction.options.getString('sanction');
          if (maxActions) g.antiNuke.maxActions = maxActions;
          if (fenetre) g.antiNuke.windowMs = fenetre * 1000;
          if (sanction) g.antiNuke.punishment = sanction;
        } else if (sub === 'antiraid') {
          const seuil = interaction.options.getInteger('seuil_arrivees');
          const fenetre = interaction.options.getInteger('fenetre_s');
          if (seuil) g.antiRaid.joinThreshold = seuil;
          if (fenetre) g.antiRaid.windowMs = fenetre * 1000;
        } else if (sub === 'antispam') {
          const max = interaction.options.getInteger('messages_max');
          const fenetre = interaction.options.getInteger('fenetre_s');
          const sanction = interaction.options.getString('sanction');
          if (max) g.antiSpam.messageThreshold = max;
          if (fenetre) g.antiSpam.windowMs = fenetre * 1000;
          if (sanction) g.antiSpam.punishment = sanction;
        }
      });
      await interaction.reply({ ephemeral: true, content: `✅ Configuration **${sub}** mise à jour.` });
      break;
    }

    case 'backup': {
      await interaction.deferReply({ ephemeral: true });
      const backup = await createBackup(guild);
      await logSecurityEvent(guild, {
        title: '💾 Sauvegarde effectuée',
        description: `${backup.roles.length} rôles et ${backup.channels.length} salons sauvegardés.`,
        level: 'success'
      });
      await interaction.editReply(`✅ Sauvegarde créée : ${backup.roles.length} rôles, ${backup.channels.length} salons.`);
      break;
    }

    case 'restore': {
      await interaction.deferReply({ ephemeral: true });
      const backups = listBackups(guild.id);
      if (!backups.length) {
        await interaction.editReply('❌ Aucune sauvegarde disponible. Utilise `/backup` avant un incident.');
        break;
      }
      const restored = await restoreRoles(guild, backups[0]);
      await interaction.editReply(`✅ ${restored} rôle(s) restauré(s) depuis la dernière sauvegarde.`);
      break;
    }

    default:
      break;
  }
}
