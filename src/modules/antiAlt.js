import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';
import { isProtectedActor } from '../utils/permissions.js';

// Filtre permanent (indépendant du mode raid) contre les comptes alternatifs suspects :
// compte trop récent et/ou sans avatar personnalisé.
export function registerAntiAlt(client) {
  client.on('guildMemberAdd', async (member) => {
    const guild = member.guild;
    const cfg = store.guild(guild.id);
    if (!cfg.antiAlt.enabled) return;
    if (isProtectedActor(guild, member.id)) return;

    const accountAge = Date.now() - member.user.createdTimestamp;
    const tooYoung = accountAge < cfg.antiAlt.minAccountAgeMs;
    const noAvatar = cfg.antiAlt.requireAvatar && member.user.avatar === null;

    if (!tooYoung && !noAvatar) return;

    const reasonParts = [];
    if (tooYoung) reasonParts.push(`compte créé il y a moins de ${Math.round(cfg.antiAlt.minAccountAgeMs / 3_600_000)}h`);
    if (noAvatar) reasonParts.push('aucun avatar personnalisé');
    const reason = `[Anti-Alt] ${reasonParts.join(' & ')}`;

    try {
      if (cfg.antiAlt.punishment === 'ban') {
        await guild.bans.create(member.id, { reason });
      } else {
        await member.kick(reason);
      }
      await logSecurityEvent(guild, {
        title: '🕵️ Compte suspect refusé (Anti-Alt)',
        description: `<@${member.id}> (\`${member.user.tag}\`) a été **${cfg.antiAlt.punishment === 'ban' ? 'banni' : 'expulsé'}**.`,
        level: 'warn',
        fields: [{ name: 'Raison', value: reasonParts.join('\n') }]
      });
    } catch (err) {
      console.error('Échec de la sanction anti-alt:', err.message);
    }
  });
}
