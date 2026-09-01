import { EmbedBuilder } from 'discord.js';
import { store } from '../store.js';
import { lockdownGuild, unlockGuild } from '../modules/antiRaid.js';
import { createBackup, listBackups, restoreRoles } from '../modules/backup.js';
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

    default:
      await message.reply(`❓ Commande inconnue. Tape \`*help\` pour voir toutes les commandes.`);
  }
}
