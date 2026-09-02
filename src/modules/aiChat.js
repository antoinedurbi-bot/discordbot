import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-5';
const MAX_HISTORY = 20; // 10 échanges par salon
const COOLDOWN_MS = 5000;
const DISCORD_MESSAGE_LIMIT = 2000;

const SYSTEM_PROMPT =
  'Tu es l\'assistant IA du bot de protection de ce serveur Discord. Réponds en français, ' +
  'de façon concise et naturelle (adaptée au chat Discord, pas de pavés). Tu peux discuter de ' +
  'tout, mais si on te pose des questions sur la sécurité/modération du serveur, sois utile et précis.';

let client = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const history = new Map(); // Map<channelId, {role, content}[]>
const cooldowns = new Map(); // Map<userId, timestamp>

function getHistory(channelId) {
  if (!history.has(channelId)) history.set(channelId, []);
  return history.get(channelId);
}

function chunkText(text, size = DISCORD_MESSAGE_LIMIT - 100) {
  const chunks = [];
  let remaining = text;
  while (remaining.length > size) {
    let cut = remaining.lastIndexOf('\n', size);
    if (cut < size * 0.5) cut = size;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function askAI(message, prompt) {
  const anthropic = getClient();
  if (!anthropic) {
    await message.reply('❌ Le chat IA n\'est pas configuré (clé `ANTHROPIC_API_KEY` manquante sur l\'hébergement).');
    return;
  }

  const now = Date.now();
  const lastUse = cooldowns.get(message.author.id) ?? 0;
  if (now - lastUse < COOLDOWN_MS) {
    await message.reply(`⏳ Attends ${Math.ceil((COOLDOWN_MS - (now - lastUse)) / 1000)}s avant de reposer une question.`);
    return;
  }
  cooldowns.set(message.author.id, now);

  const channelHistory = getHistory(message.channel.id);
  channelHistory.push({ role: 'user', content: prompt });

  await message.channel.sendTyping().catch(() => null);

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      output_config: { effort: 'low' },
      messages: channelHistory
    });

    const text = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    if (!text) {
      await message.reply('🤔 Je n\'ai pas de réponse à te donner pour ça.');
      return;
    }

    channelHistory.push({ role: 'assistant', content: text });
    if (channelHistory.length > MAX_HISTORY) channelHistory.splice(0, channelHistory.length - MAX_HISTORY);

    const chunks = chunkText(text);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } catch (err) {
    channelHistory.pop(); // retire le message user raté pour ne pas polluer l'historique
    if (err instanceof Anthropic.RateLimitError) {
      await message.reply('⏳ Trop de demandes en ce moment, réessaie dans un instant.');
    } else if (err instanceof Anthropic.AuthenticationError) {
      await message.reply('❌ Clé API invalide — vérifie `ANTHROPIC_API_KEY`.');
    } else if (err instanceof Anthropic.APIError) {
      await message.reply(`❌ Erreur API (${err.status}) : ${err.message}`);
    } else {
      console.error('Erreur chat IA:', err);
      await message.reply('❌ Une erreur est survenue.');
    }
  }
}

export function registerAiChat(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    if (!message.mentions.has(client.user.id)) return;
    if (message.content.startsWith('*')) return; // laisse les prefix commands gérer ça

    const prompt = message.content.replace(/<@!?\d+>/g, '').trim();
    if (!prompt) {
      await message.reply('👋 Dis-moi quelque chose, ou utilise `*ai <ta question>` !');
      return;
    }
    await askAI(message, prompt);
  });
}
