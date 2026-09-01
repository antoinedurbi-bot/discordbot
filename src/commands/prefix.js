import { store } from '../store.js';
import { lockdownGuild, unlockGuild } from '../modules/antiRaid.js';
import { createBackup, listBackups, restoreRoles } from '../modules/backup.js';
import { canManageBot } from '../utils/permissions.js';
import { logSecurityEvent } from '../logger.js';

const PREFIX = '*';

export async function handlePrefixCommand(message) {
  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  const { guild, member, author } = message;
  if (!guild || !member) return;

  if (!canManageBot(member)) {
    await message.reply('⛔ Tu n\'as pas la permission.');
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
      await message.reply(
        `**État de protection — ${guild.name}**\n` +
          `Mode panique: ${cfg.panicMode ? '🔴 ACTIF' : '🟢 inactif'}\n` +
          `Anti-Nuke: ${cfg.antiNuke.enabled ? 'activé' : 'désactivé'}\n` +
          `Anti-Raid: ${cfg.antiRaid.enabled ? 'activé' : 'désactivé'}\n` +
          `Anti-Spam: ${cfg.antiSpam.enabled ? 'activé' : 'désactivé'}\n` +
          `Whitelist: ${cfg.whitelist.length} membre(s)`
      );
      break;
    }

    case 'whitelist': {
      const sub = args[0];
      if (sub === 'list') {
        const cfg = store.guild(guild.id);
        await message.reply(cfg.whitelist.length ? cfg.whitelist.map((id) => `<@${id}>`).join('\n') : 'Whitelist vide.');
        break;
      }
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply('`Usage: *whitelist add/remove <@user>`');
        break;
      }
      store.update(guild.id, (g) => {
        if (sub === 'add') {
          if (!g.whitelist.includes(target.id)) g.whitelist.push(target.id);
        } else if (sub === 'remove') {
          g.whitelist = g.whitelist.filter((id) => id !== target.id);
        }
      });
      await message.reply(sub === 'add' ? `✅ <@${target.id}> ajouté.` : `✅ <@${target.id}> retiré.`);
      break;
    }

    case 'backup': {
      const backup = await createBackup(guild);
      await message.reply(`✅ Sauvegarde : ${backup.roles.length} rôles, ${backup.channels.length} salons.`);
      break;
    }

    case 'restore': {
      const backups = listBackups(guild.id);
      if (!backups.length) {
        await message.reply('❌ Aucune sauvegarde. Utilise `*backup` avant.');
        break;
      }
      const restored = await restoreRoles(guild, backups[0]);
      await message.reply(`✅ ${restored} rôle(s) restauré(s).`);
      break;
    }

    default:
      await message.reply(`Commande inconnue. Utilise: \`*panic\`, \`*unlock\`, \`*status\`, \`*whitelist\`, \`*backup\`, \`*restore\``);
  }
}
