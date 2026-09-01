import { EmbedBuilder } from 'discord.js';
import { store } from '../store.js';
import { lockdownGuild, unlockGuild } from '../modules/antiRaid.js';
import { createBackup, listBackups, restoreRoles } from '../modules/backup.js';
import { getSnipe, getEditSnipe } from '../modules/snipe.js';
import { purgeMessages, buildUserInfoEmbed, buildServerInfoEmbed } from '../modules/moderation.js';
import { canManageBot } from '../utils/permissions.js';

const PREFIX = '*';

const HELP_ENTRIES = [
  { cmd: '*panic', alias: '*p', desc: 'Verrouille immédiatement tout le serveur' },
  { cmd: '*unlock', alias: '*u', desc: 'Lève le verrouillage d\'urgence' },
  { cmd: '*status', alias: '*s', desc: 'Affiche l\'état de la protection' },
  { cmd: '*whitelist add/remove/list @membre', alias: '*wl', desc: 'Gère les membres protégés' },
  { cmd: '*setlog #salon', alias: '*log', desc: 'Définit le salon des alertes de sécurité' },
  { cmd: '*backup', alias: '*bk', desc: 'Sauvegarde la structure du serveur (rôles/salons)' },
  { cmd: '*restore', alias: '*rs', desc: 'Restaure les rôles depuis la dernière sauvegarde' },
  { cmd: '*snipe', alias: '*sn', desc: 'Affiche le dernier message supprimé du salon' },
  { cmd: '*editsnipe', alias: '*es', desc: 'Affiche le dernier message édité du salon' },
  { cmd: '*clear <nombre>', alias: '*c', desc: 'Supprime en masse des messages (max 100)' },
  { cmd: '*kick @membre [raison]', alias: '*k', desc: 'Expulse un membre' },
  { cmd: '*ban @membre [raison]', alias: '*b', desc: 'Bannit un membre' },
  { cmd: '*unban <id>', alias: '*ub', desc: 'Débannit un utilisateur via son ID' },
  { cmd: '*mute @membre <minutes> [raison]', alias: '*m', desc: 'Timeout un membre' },
  { cmd: '*unmute @membre', alias: '*um', desc: 'Retire le timeout d\'un membre' },
  { cmd: '*userinfo [@membre]', alias: '*ui', desc: 'Affiche les infos d\'un membre' },
  { cmd: '*serverinfo', alias: '*si', desc: 'Affiche les infos du serveur' },
  { cmd: '*avatar [@membre]', alias: '*av', desc: 'Affiche l\'avatar en grand' },
  { cmd: '*ping', desc: 'Affiche la latence du bot' },
  { cmd: '*help', alias: '*h', desc: 'Affiche cette aide' }
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
  h: 'help'
};

function usageError(message, text) {
  return message.reply(`❌ ${text}`);
}

export async function handlePrefixCommand(message) {
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  let command = args.shift()?.toLowerCase();
  if (!command) return;
  command = ALIASES[command] ?? command;

  const { guild, member, author } = message;
  if (!guild || !member) return;

  if (command === 'help') {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Commandes de protection')
      .setColor(0x5865f2)
      .setDescription('Préfixe : `*` — les commandes slash `/` fonctionnent aussi.')
      .addFields(
        HELP_ENTRIES.map((e) => ({
          name: `${e.cmd}  •  ${e.alias}`,
          value: e.desc
        }))
      );
    await message.reply({ embeds: [embed] });
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
      const amount = parseInt(args[0], 10);
      if (!amount || amount < 1) {
        await usageError(message, 'Usage : `*clear <nombre entre 1 et 100>`');
        break;
      }
      const deleted = await purgeMessages(message.channel, amount + 1); // +1 pour inclure la commande elle-même
      await message.channel.send(`✅ ${deleted - 1} message(s) supprimé(s).`).then((m) => setTimeout(() => m.delete().catch(() => null), 4000));
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

    default:
      await message.reply(`❓ Commande inconnue. Tape \`*help\` pour voir toutes les commandes.`);
  }
}
