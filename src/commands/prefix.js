import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } from 'discord.js';
import { store } from '../store.js';
import { lockdownGuild, unlockGuild } from '../modules/antiRaid.js';
import { createBackup, listBackups, restoreRoles } from '../modules/backup.js';
import { getSnipe, getEditSnipe } from '../modules/snipe.js';
import {
  purgeMessages,
  buildUserInfoEmbed,
  buildServerInfoEmbed,
  setChannelLocked,
  setChannelSlowmode
} from '../modules/moderation.js';
import { buildVerificationMessage } from '../modules/verification.js';
import { setRequire2FA } from '../modules/security.js';
import { canManageBot } from '../utils/permissions.js';

const PREFIX = '*';

const HELP_PAGES = [
  {
    title: '🛡️ Protection',
    entries: [
      { cmd: '*panic', alias: '*p', desc: 'Verrouille immédiatement tout le serveur' },
      { cmd: '*unlock', alias: '*u', desc: 'Lève le verrouillage d\'urgence' },
      { cmd: '*status', alias: '*s', desc: 'Affiche l\'état de la protection' },
      { cmd: '*whitelist add/remove/list @membre', alias: '*wl', desc: 'Gère les membres protégés' },
      { cmd: '*setlog #salon', alias: '*log', desc: 'Définit le salon des alertes de sécurité' },
      { cmd: '*backup', alias: '*bk', desc: 'Sauvegarde la structure du serveur (rôles/salons)' },
      { cmd: '*restore', alias: '*rs', desc: 'Restaure les rôles depuis la dernière sauvegarde' }
    ]
  },
  {
    title: '🔨 Modération',
    entries: [
      { cmd: '*clear <nombre>', alias: '*c', desc: 'Supprime N derniers messages' },
      { cmd: '*clear all', alias: '*c all', desc: 'Supprime tout l\'historique récent du salon' },
      { cmd: '*clear @membre [nombre]', alias: '*c @membre', desc: 'Supprime les messages d\'un membre' },
      { cmd: '*kick @membre [raison]', alias: '*k', desc: 'Expulse un membre' },
      { cmd: '*ban @membre [raison]', alias: '*b', desc: 'Bannit un membre' },
      { cmd: '*unban <id>', alias: '*ub', desc: 'Débannit un utilisateur via son ID' },
      { cmd: '*mute @membre <minutes> [raison]', alias: '*m', desc: 'Timeout un membre' },
      { cmd: '*unmute @membre', alias: '*um', desc: 'Retire le timeout d\'un membre' }
    ]
  },
  {
    title: '🔍 Snipe & Infos',
    entries: [
      { cmd: '*snipe', alias: '*sn', desc: 'Affiche le dernier message supprimé du salon' },
      { cmd: '*editsnipe', alias: '*es', desc: 'Affiche le dernier message édité du salon' },
      { cmd: '*userinfo [@membre]', alias: '*ui', desc: 'Affiche les infos d\'un membre' },
      { cmd: '*serverinfo', alias: '*si', desc: 'Affiche les infos du serveur' },
      { cmd: '*avatar [@membre]', alias: '*av', desc: 'Affiche l\'avatar en grand' },
      { cmd: '*ping', desc: 'Affiche la latence du bot' },
      { cmd: '*help', alias: '*h', desc: 'Affiche cette aide' }
    ]
  },
  {
    title: '⚠️ Avertissements',
    entries: [
      { cmd: '*warn @membre <raison>', alias: '*w', desc: 'Ajoute un avertissement à un membre' },
      { cmd: '*warnings @membre', alias: '*ws', desc: 'Liste les avertissements d\'un membre' },
      { cmd: '*clearwarns @membre', alias: '*cw', desc: 'Efface les avertissements d\'un membre' }
    ]
  },
  {
    title: '🕵️ Sécurité avancée',
    entries: [
      { cmd: '*antialt on/off', alias: '*aa', desc: 'Kick/ban les comptes trop récents ou sans avatar' },
      { cmd: '*antiphishing on/off', alias: '*ap', desc: 'Détecte et bloque les liens de phishing' },
      { cmd: '*require2fa on/off', alias: '*2fa', desc: 'Exige la 2FA pour les actions de modération' },
      { cmd: '*verify #salon @role_non_vérifié [@role_membre]', alias: '*v', desc: 'Met en place la vérification à l\'arrivée' }
    ]
  },
  {
    title: '⚙️ Serveur',
    entries: [
      { cmd: '*welcome #salon <message>', alias: '*wc', desc: 'Active un message de bienvenue ({user}, {server})' },
      { cmd: '*welcome off', desc: 'Désactive le message de bienvenue' },
      { cmd: '*leave #salon <message>', alias: '*lv', desc: 'Active un message de départ' },
      { cmd: '*autorole @role', alias: '*ar', desc: 'Attribue un rôle automatiquement à l\'arrivée' },
      { cmd: '*lockchannel [#salon] [@rôles staff]', alias: '*lc', desc: 'Verrouille un salon (sauf admins + rôles précisés)' },
      { cmd: '*unlockchannel [#salon]', alias: '*ulc', desc: 'Déverrouille un salon précis' },
      { cmd: '*slowmode <secondes> [#salon]', alias: '*sm', desc: 'Définit le mode lent d\'un salon' },
      { cmd: '*stats', alias: '*st', desc: 'Statistiques du serveur (arrivées/départs, warns...)' }
    ]
  }
];

const ALIASES = {
  p: 'panic',
  u: 'unlock',
  s: 'status',
  wl: 'whitelist',
  log: 'setlog',
  bk: 'backup',
  rs: 'restore',
  sn: 'snipe',
  es: 'editsnipe',
  c: 'clear',
  purge: 'clear',
  k: 'kick',
  b: 'ban',
  ub: 'unban',
  m: 'mute',
  timeout: 'mute',
  um: 'unmute',
  untimeout: 'unmute',
  ui: 'userinfo',
  whois: 'userinfo',
  si: 'serverinfo',
  av: 'avatar',
  h: 'help',
  w: 'warn',
  ws: 'warnings',
  cw: 'clearwarns',
  aa: 'antialt',
  ap: 'antiphishing',
  '2fa': 'require2fa',
  v: 'verify',
  wc: 'welcome',
  lv: 'leave',
  ar: 'autorole',
  lc: 'lockchannel',
  ulc: 'unlockchannel',
  sm: 'slowmode',
  st: 'stats'
};

function usageError(message, text) {
  return message.reply(`❌ ${text}`);
}

function buildHelpEmbed(pageIndex) {
  const page = HELP_PAGES[pageIndex];
  return new EmbedBuilder()
    .setTitle(page.title)
    .setColor(0x5865f2)
    .setDescription('Préfixe : `*` — les commandes slash `/` fonctionnent aussi.')
    .addFields(page.entries.map((e) => ({ name: `${e.cmd}${e.alias ? `  •  ${e.alias}` : ''}`, value: e.desc })))
    .setFooter({ text: `Page ${pageIndex + 1}/${HELP_PAGES.length}` });
}

function buildHelpRow(pageIndex) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('help_prev').setEmoji('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('help_next')
      .setEmoji('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIndex === HELP_PAGES.length - 1)
  );
}

export async function handlePrefixCommand(message) {
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  let command = args.shift()?.toLowerCase();
  if (!command) return;
  command = ALIASES[command] ?? command;

  const { guild, member, author } = message;
  if (!guild || !member) return;

  if (command === 'help') {
    let pageIndex = 0;
    const reply = await message.reply({ embeds: [buildHelpEmbed(pageIndex)], components: [buildHelpRow(pageIndex)] });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000
    });

    collector.on('collect', async (interaction) => {
      if (interaction.user.id !== author.id) {
        await interaction.reply({ content: '❌ Seule la personne ayant lancé `*help` peut naviguer.', ephemeral: true });
        return;
      }
      pageIndex = interaction.customId === 'help_next' ? Math.min(HELP_PAGES.length - 1, pageIndex + 1) : Math.max(0, pageIndex - 1);
      await interaction.update({ embeds: [buildHelpEmbed(pageIndex)], components: [buildHelpRow(pageIndex)] });
    });

    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => null);
    });
    return;
  }

  if (!canManageBot(member)) {
    await message.reply('⛔ Tu n\'as pas la permission (Administrateur requis).');
    return;
  }

  switch (command) {
    case 'panic': {
      await lockdownGuild(guild, `Verrouillage manuel par ${author.tag}`);
      await message.reply('🔒 Serveur verrouillé. Utilise `*unlock` pour lever.');
      break;
    }

    case 'unlock': {
      await unlockGuild(guild, `Levée manuelle par ${author.tag}`);
      await message.reply('🔓 Verrouillage levé.');
      break;
    }

    case 'status': {
      const cfg = store.guild(guild.id);
      const embed = new EmbedBuilder()
        .setTitle(`État de protection — ${guild.name}`)
        .setColor(cfg.panicMode ? 0xed4245 : 0x57f287)
        .addFields(
          { name: 'Mode panique', value: cfg.panicMode ? '🔴 ACTIF' : '🟢 inactif', inline: true },
          { name: 'Anti-Nuke', value: cfg.antiNuke.enabled ? '✅ activé' : '⛔ désactivé', inline: true },
          { name: 'Anti-Raid', value: cfg.antiRaid.enabled ? '✅ activé' : '⛔ désactivé', inline: true },
          { name: 'Anti-Spam', value: cfg.antiSpam.enabled ? '✅ activé' : '⛔ désactivé', inline: true },
          { name: 'Whitelist', value: `${cfg.whitelist.length} membre(s)`, inline: true },
          { name: 'Salon de logs', value: cfg.logChannelId ? `<#${cfg.logChannelId}>` : 'non défini', inline: true }
        );
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'whitelist': {
      const sub = args[0]?.toLowerCase();
      if (!sub || !['add', 'remove', 'list'].includes(sub)) {
        await usageError(message, 'Usage : `*whitelist add|remove @membre` ou `*whitelist list`');
        break;
      }
      if (sub === 'list') {
        const cfg = store.guild(guild.id);
        await message.reply(cfg.whitelist.length ? cfg.whitelist.map((id) => `<@${id}>`).join('\n') : 'Whitelist vide.');
        break;
      }
      const target = message.mentions.users.first();
      if (!target) {
        await usageError(message, 'Mentionne un membre : `*whitelist add @membre`');
        break;
      }
      store.update(guild.id, (g) => {
        if (sub === 'add') {
          if (!g.whitelist.includes(target.id)) g.whitelist.push(target.id);
        } else {
          g.whitelist = g.whitelist.filter((id) => id !== target.id);
        }
      });
      await message.reply(sub === 'add' ? `✅ <@${target.id}> ajouté à la whitelist.` : `✅ <@${target.id}> retiré de la whitelist.`);
      break;
    }

    case 'setlog': {
      const channel = message.mentions.channels.first();
      if (!channel) {
        await usageError(message, 'Mentionne un salon : `*setlog #salon`');
        break;
      }
      store.update(guild.id, (g) => {
        g.logChannelId = channel.id;
      });
      await message.reply(`✅ Salon de logs défini sur <#${channel.id}>.`);
      break;
    }

    case 'backup': {
      const backup = await createBackup(guild);
      await message.reply(`✅ Sauvegarde créée : ${backup.roles.length} rôles, ${backup.channels.length} salons.`);
      break;
    }

    case 'restore': {
      const backups = listBackups(guild.id);
      if (!backups.length) {
        await usageError(message, 'Aucune sauvegarde disponible. Utilise `*backup` avant un incident.');
        break;
      }
      const restored = await restoreRoles(guild, backups[0]);
      await message.reply(`✅ ${restored} rôle(s) restauré(s) depuis la dernière sauvegarde.`);
      break;
    }

    case 'snipe': {
      const entry = getSnipe(message.channel.id);
      if (!entry) {
        await message.reply('❌ Rien à sniper dans ce salon.');
        break;
      }
      const embed = new EmbedBuilder()
        .setAuthor({ name: entry.authorTag, iconURL: entry.avatarURL ?? undefined })
        .setDescription(entry.content)
        .setColor(0xed4245)
        .setFooter({ text: 'Message supprimé' })
        .setTimestamp(entry.timestamp);
      if (entry.attachments.length) embed.addFields({ name: 'Pièces jointes', value: entry.attachments.join('\n') });
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'editsnipe': {
      const entry = getEditSnipe(message.channel.id);
      if (!entry) {
        await message.reply('❌ Rien à sniper dans ce salon.');
        break;
      }
      const embed = new EmbedBuilder()
        .setAuthor({ name: entry.authorTag, iconURL: entry.avatarURL ?? undefined })
        .addFields({ name: 'Avant', value: entry.before }, { name: 'Après', value: entry.after })
        .setColor(0xf5a623)
        .setFooter({ text: 'Message édité' })
        .setTimestamp(entry.timestamp);
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'clear': {
      const first = args[0];
      const mentioned = message.mentions.users.first();
      let opts;
      let label;

      if (mentioned) {
        const amount = parseInt(args[1], 10);
        opts = { userId: mentioned.id, amount: amount && amount > 0 ? amount : Infinity };
        label = `de <@${mentioned.id}>`;
      } else if (first?.toLowerCase() === 'all') {
        opts = { all: true };
        label = 'tout l\'historique récent';
      } else {
        const amount = parseInt(first, 10);
        if (!amount || amount < 1) {
          await usageError(message, 'Usage : `*clear <nombre>` | `*clear all` | `*clear @membre [nombre]`');
          break;
        }
        opts = { amount };
        label = `${amount} message(s)`;
      }

      await message.delete().catch(() => null);
      const deleted = await purgeMessages(message.channel, opts);
      const confirm = await message.channel.send(`✅ ${deleted} message(s) supprimé(s) (${label}).`);
      setTimeout(() => confirm.delete().catch(() => null), 4000);
      break;
    }

    case 'kick': {
      const target = message.mentions.members?.first();
      if (!target) {
        await usageError(message, 'Mentionne un membre : `*kick @membre [raison]`');
        break;
      }
      if (!target.kickable) {
        await message.reply('❌ Je ne peux pas expulser ce membre (rôle trop élevé).');
        break;
      }
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
      await target.kick(`${reason} — par ${author.tag}`);
      await message.reply(`✅ <@${target.id}> expulsé. Raison : ${reason}`);
      break;
    }

    case 'ban': {
      const target = message.mentions.members?.first();
      if (!target) {
        await usageError(message, 'Mentionne un membre : `*ban @membre [raison]`');
        break;
      }
      if (!target.bannable) {
        await message.reply('❌ Je ne peux pas bannir ce membre (rôle trop élevé).');
        break;
      }
      const reason = args.slice(1).join(' ') || 'Aucune raison fournie';
      await target.ban({ reason: `${reason} — par ${author.tag}` });
      await message.reply(`✅ <@${target.id}> banni. Raison : ${reason}`);
      break;
    }

    case 'unban': {
      const userId = args[0];
      if (!userId) {
        await usageError(message, 'Usage : `*unban <id utilisateur>`');
        break;
      }
      await guild.bans.remove(userId, `Débanni par ${author.tag}`).catch(() => null);
      await message.reply(`✅ Utilisateur \`${userId}\` débanni (si le ban existait).`);
      break;
    }

    case 'mute': {
      const target = message.mentions.members?.first();
      const minutes = parseInt(args[1], 10);
      if (!target || !minutes || minutes < 1) {
        await usageError(message, 'Usage : `*mute @membre <minutes> [raison]`');
        break;
      }
      const reason = args.slice(2).join(' ') || 'Aucune raison fournie';
      await target.timeout(minutes * 60 * 1000, `${reason} — par ${author.tag}`);
      await message.reply(`✅ <@${target.id}> timeout pour ${minutes} min. Raison : ${reason}`);
      break;
    }

    case 'unmute': {
      const target = message.mentions.members?.first();
      if (!target) {
        await usageError(message, 'Mentionne un membre : `*unmute @membre`');
        break;
      }
      await target.timeout(null, `Timeout retiré par ${author.tag}`);
      await message.reply(`✅ Timeout retiré pour <@${target.id}>.`);
      break;
    }

    case 'userinfo': {
      const target = message.mentions.members?.first() ?? member;
      await message.reply({ embeds: [buildUserInfoEmbed(target)] });
      break;
    }

    case 'serverinfo': {
      await message.reply({ embeds: [buildServerInfoEmbed(guild)] });
      break;
    }

    case 'avatar': {
      const target = message.mentions.users?.first() ?? author;
      const embed = new EmbedBuilder()
        .setTitle(`Avatar de ${target.tag}`)
        .setImage(target.displayAvatarURL({ size: 512 }))
        .setColor(0x5865f2);
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'ping': {
      await message.reply(`🏓 Pong ! Latence WebSocket : ${message.client.ws.ping}ms`);
      break;
    }

    case 'warn': {
      const target = message.mentions.users.first();
      const reason = args.slice(1).join(' ');
      if (!target || !reason) {
        await usageError(message, 'Usage : `*warn @membre <raison>`');
        break;
      }
      const warn = store.addWarn(guild.id, { userId: target.id, moderatorId: author.id, reason });
      const total = store.getWarns(guild.id, target.id).length;
      await message.reply(`⚠️ <@${target.id}> averti (total : ${total}). Raison : ${reason} \`(#${warn.id})\``);
      break;
    }

    case 'warnings': {
      const target = message.mentions.users.first() ?? author;
      const warns = store.getWarns(guild.id, target.id);
      if (!warns.length) {
        await message.reply(`✅ <@${target.id}> n'a aucun avertissement.`);
        break;
      }
      const embed = new EmbedBuilder()
        .setTitle(`Avertissements de ${target.tag} (${warns.length})`)
        .setColor(0xf5a623)
        .addFields(
          warns.slice(0, 20).map((w) => ({
            name: `#${w.id} — <t:${Math.floor(w.at / 1000)}:R>`,
            value: `${w.reason} (par <@${w.moderatorId}>)`
          }))
        );
      await message.reply({ embeds: [embed] });
      break;
    }

    case 'clearwarns': {
      const target = message.mentions.users.first();
      if (!target) {
        await usageError(message, 'Mentionne un membre : `*clearwarns @membre`');
        break;
      }
      const removed = store.clearWarns(guild.id, target.id);
      await message.reply(`✅ ${removed} avertissement(s) effacé(s) pour <@${target.id}>.`);
      break;
    }

    case 'antialt': {
      const state = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(state)) {
        await usageError(message, 'Usage : `*antialt on` ou `*antialt off`');
        break;
      }
      store.update(guild.id, (g) => {
        g.antiAlt.enabled = state === 'on';
      });
      await message.reply(`✅ Anti-Alt ${state === 'on' ? 'activé' : 'désactivé'}.`);
      break;
    }

    case 'antiphishing': {
      const state = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(state)) {
        await usageError(message, 'Usage : `*antiphishing on` ou `*antiphishing off`');
        break;
      }
      store.update(guild.id, (g) => {
        g.antiPhishing.enabled = state === 'on';
      });
      await message.reply(`✅ Anti-Phishing ${state === 'on' ? 'activé' : 'désactivé'}.`);
      break;
    }

    case 'require2fa': {
      const state = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(state)) {
        await usageError(message, 'Usage : `*require2fa on` ou `*require2fa off`');
        break;
      }
      const result = await setRequire2FA(guild, state === 'on');
      if (result.ok) {
        await message.reply(`✅ 2FA obligatoire pour la modération : ${state === 'on' ? 'activée' : 'désactivée'}.`);
      } else {
        await message.reply(
          `⚠️ Discord n'autorise pas le bot à changer ce réglage automatiquement (limitation de l'API). ` +
            `Active-le manuellement : **Paramètres du serveur > Sûreté > Authentification à deux facteurs pour la modération**.`
        );
      }
      break;
    }

    case 'verify': {
      const channel = message.mentions.channels.first();
      const roles = [...message.mentions.roles.values()];
      const unverifiedRole = roles[0];
      const memberRole = roles[1];
      if (!channel || !unverifiedRole) {
        await usageError(message, 'Usage : `*verify #salon @role_non_vérifié [@role_membre]`');
        break;
      }
      store.update(guild.id, (g) => {
        g.verification.enabled = true;
        g.verification.channelId = channel.id;
        g.verification.unverifiedRoleId = unverifiedRole.id;
        g.verification.memberRoleId = memberRole?.id ?? null;
      });
      await channel.send(buildVerificationMessage(guild)).catch(() => null);
      await message.reply(`✅ Vérification activée dans <#${channel.id}>. Nouveaux membres → rôle <@&${unverifiedRole.id}>.`);
      break;
    }

    case 'welcome': {
      if (args[0]?.toLowerCase() === 'off') {
        store.update(guild.id, (g) => {
          g.welcome.enabled = false;
        });
        await message.reply('✅ Message de bienvenue désactivé.');
        break;
      }
      const channel = message.mentions.channels.first();
      const text = args.slice(1).join(' ');
      if (!channel || !text) {
        await usageError(message, 'Usage : `*welcome #salon <message>` (variables : {user}, {server}) ou `*welcome off`');
        break;
      }
      store.update(guild.id, (g) => {
        g.welcome.enabled = true;
        g.welcome.channelId = channel.id;
        g.welcome.message = text;
      });
      await message.reply(`✅ Message de bienvenue activé dans <#${channel.id}>.`);
      break;
    }

    case 'leave': {
      if (args[0]?.toLowerCase() === 'off') {
        store.update(guild.id, (g) => {
          g.welcome.leaveEnabled = false;
        });
        await message.reply('✅ Message de départ désactivé.');
        break;
      }
      const channel = message.mentions.channels.first();
      const text = args.slice(1).join(' ');
      if (!channel || !text) {
        await usageError(message, 'Usage : `*leave #salon <message>` (variables : {user}, {server}) ou `*leave off`');
        break;
      }
      store.update(guild.id, (g) => {
        g.welcome.leaveEnabled = true;
        g.welcome.leaveChannelId = channel.id;
        g.welcome.leaveMessage = text;
      });
      await message.reply(`✅ Message de départ activé dans <#${channel.id}>.`);
      break;
    }

    case 'autorole': {
      if (args[0]?.toLowerCase() === 'off') {
        store.update(guild.id, (g) => {
          g.welcome.autoRoleId = null;
        });
        await message.reply('✅ Auto-role désactivé.');
        break;
      }
      const role = message.mentions.roles.first();
      if (!role) {
        await usageError(message, 'Usage : `*autorole @role` ou `*autorole off`');
        break;
      }
      store.update(guild.id, (g) => {
        g.welcome.autoRoleId = role.id;
      });
      await message.reply(`✅ Nouveaux membres recevront automatiquement <@&${role.id}>.`);
      break;
    }

    case 'lockchannel': {
      const channel = message.mentions.channels.first() ?? message.channel;
      const allowRoles = [...message.mentions.roles.values()];
      await setChannelLocked(channel, true, `Verrouillé par ${author.tag}`, allowRoles);
      const extra = allowRoles.length ? ` (accès conservé pour ${allowRoles.map((r) => `<@&${r.id}>`).join(', ')})` : '';
      await message.reply(`🔒 <#${channel.id}> verrouillé pour tout le monde sauf les administrateurs${extra}.`);
      break;
    }

    case 'unlockchannel': {
      const channel = message.mentions.channels.first() ?? message.channel;
      const allowRoles = [...message.mentions.roles.values()];
      await setChannelLocked(channel, false, `Déverrouillé par ${author.tag}`, allowRoles);
      await message.reply(`🔓 <#${channel.id}> déverrouillé.`);
      break;
    }

    case 'slowmode': {
      const seconds = parseInt(args[0], 10);
      const channel = message.mentions.channels.first() ?? message.channel;
      if (Number.isNaN(seconds) || seconds < 0) {
        await usageError(message, 'Usage : `*slowmode <secondes 0-21600> [#salon]`');
        break;
      }
      await setChannelSlowmode(channel, seconds);
      await message.reply(seconds === 0 ? `✅ Mode lent désactivé sur <#${channel.id}>.` : `✅ Mode lent réglé à ${seconds}s sur <#${channel.id}>.`);
      break;
    }

    case 'stats': {
      const cfg = store.guild(guild.id);
      const embed = new EmbedBuilder()
        .setTitle(`Statistiques — ${guild.name}`)
        .setColor(0x5865f2)
        .addFields(
          { name: 'Arrivées (aujourd\'hui)', value: `${cfg.stats.joins}`, inline: true },
          { name: 'Départs (aujourd\'hui)', value: `${cfg.stats.leaves}`, inline: true },
          { name: 'Membres', value: `${guild.memberCount}`, inline: true },
          { name: 'Avertissements enregistrés', value: `${cfg.warns.length}`, inline: true },
          { name: 'Incidents de sécurité loggés', value: `${cfg.incidents.length}`, inline: true }
        );
      await message.reply({ embeds: [embed] });
      break;
    }

    default:
      await message.reply(`❓ Commande inconnue. Tape \`*help\` pour voir toutes les commandes.`);
  }
}
