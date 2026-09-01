import { GuildMFALevel } from 'discord.js';

// Discord restreint la modification du niveau MFA du serveur aux comptes utilisateurs avec 2FA active ;
// un bot ne peut généralement pas l'activer lui-même. On tente quand même l'appel et on retombe
// proprement sur une instruction manuelle si l'API refuse.
export async function setRequire2FA(guild, enabled) {
  try {
    await guild.setMFALevel(enabled ? GuildMFALevel.Elevated : GuildMFALevel.None);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
