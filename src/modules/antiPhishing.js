import { store } from '../store.js';
import { logSecurityEvent } from '../logger.js';
import { isProtectedActor } from '../utils/permissions.js';

// Domaines/patterns fréquemment utilisés dans les scams Discord (faux Nitro, faux Steam, grabbers d'IP/token...).
// Liste non exhaustive, à enrichir si de nouveaux domaines de phishing apparaissent.
const PHISHING_PATTERNS = [
  /discord-?nitro\.(?!com|gift\b)\S+/i,
  /discordapp-?nitro\.\S+/i,
  /discord\.(gift|com)-\S+\./i, // ex: discord.com-free-nitro.xyz
  /steamcommunlty\.\S+/i,
  /steamconmunity\.\S+/i,
  /steam-?community\.[a-z]{2,4}\.[a-z]{2,6}/i,
  /free-?nitro\.\S+/i,
  /nitro-?free\.\S+/i,
  /dlscord\.\S+/i,
  /dicord\.\S+/i,
  /discrod\.\S+/i
];

function containsPhishing(content) {
  if (!content) return false;
  return PHISHING_PATTERNS.some((re) => re.test(content));
}

export function registerAntiPhishing(client) {
  client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;

    const guild = message.guild;
    const cfg = store.guild(guild.id);
    if (!cfg.antiPhishing.enabled) return;
    if (isProtectedActor(guild, message.author.id)) return;
    if (!containsPhishing(message.content)) return;

    await message.delete().catch(() => null);

    const member = message.member;
    try {
      if (cfg.antiPhishing.punishment === 'ban') {
        await guild.bans.create(message.author.id, { reason: '[Anti-Phishing] Lien de phishing détecté' });
      } else if (cfg.antiPhishing.punishment === 'kick') {
        await member?.kick('[Anti-Phishing] Lien de phishing détecté');
      } else {
        await member?.timeout(60 * 60 * 1000, '[Anti-Phishing] Lien de phishing détecté');
      }
    } catch (err) {
      console.error('Échec de la sanction anti-phishing:', err.message);
    }

    await logSecurityEvent(guild, {
      title: '🎣 Lien de phishing bloqué',
      description: `<@${message.author.id}> a été sanctionné (**${cfg.antiPhishing.punishment}**) pour un lien de phishing.`,
      level: 'danger'
    });
  });
}
