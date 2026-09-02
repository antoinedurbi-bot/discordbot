import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { registerAntiNuke } from './modules/antiNuke.js';
import { registerAntiRaid } from './modules/antiRaid.js';
import { registerAntiSpam } from './modules/antiSpam.js';
import { registerSnipe } from './modules/snipe.js';
import { registerAntiAlt } from './modules/antiAlt.js';
import { registerAntiPhishing } from './modules/antiPhishing.js';
import { registerVerification } from './modules/verification.js';
import { registerWelcome } from './modules/welcome.js';
import { registerEmbedBuilder } from './modules/embedBuilder.js';
import { registerAiChat } from './modules/aiChat.js';
import { handleInteraction } from './commands/index.js';
import { handlePrefixCommand } from './commands/prefix.js';
import { store } from './store.js';

const { DISCORD_TOKEN } = process.env;

if (!DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant. Copie .env.example vers .env et renseigne tes identifiants.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks
  ],
  partials: [Partials.GuildMember, Partials.Message]
});

registerAntiNuke(client);
registerAntiRaid(client);
registerAntiSpam(client);
registerSnipe(client);
registerAntiAlt(client);
registerAntiPhishing(client);
registerVerification(client);
registerWelcome(client);
registerEmbedBuilder(client);
registerAiChat(client);

client.on('interactionCreate', (interaction) => {
  handleInteraction(interaction).catch((err) => console.error('Erreur interaction:', err));
});

client.on('messageCreate', (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content.startsWith('*')) {
    handlePrefixCommand(message).catch((err) => console.error('Erreur prefix command:', err));
  }
});

client.once('clientReady', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'la sécurité du serveur 🛡️', type: 3 }],
    status: 'online'
  });

  for (const guild of client.guilds.cache.values()) {
    store.guild(guild.id); // initialise la config par défaut si absente
  }
});

process.on('unhandledRejection', (err) => console.error('Promesse rejetée non gérée:', err));

client.login(DISCORD_TOKEN);
