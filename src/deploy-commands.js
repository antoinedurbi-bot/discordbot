import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN et CLIENT_ID sont requis dans le fichier .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  console.log(`Déploiement de ${commands.length} commandes ${GUILD_ID ? `sur le serveur ${GUILD_ID}` : 'globalement'}...`);
  await rest.put(route, { body: commands });
  console.log('✅ Commandes déployées avec succès.');
} catch (err) {
  console.error('❌ Échec du déploiement des commandes:', err);
  process.exit(1);
}
