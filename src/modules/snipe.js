// Historique en mémoire des messages supprimés/édités, par salon (non persisté, volontairement volatile)
const MAX_PER_CHANNEL = 10;

const deletedTracker = new Map(); // Map<channelId, entry[]>
const editedTracker = new Map(); // Map<channelId, entry[]>

function pushEntry(tracker, channelId, entry) {
  const arr = tracker.get(channelId) ?? [];
  arr.unshift(entry);
  tracker.set(channelId, arr.slice(0, MAX_PER_CHANNEL));
}

export function registerSnipe(client) {
  client.on('messageDelete', (message) => {
    if (!message.guild || message.author?.bot) return;
    pushEntry(deletedTracker, message.channel.id, {
      content: message.content || '*[pas de texte — embed, image ou contenu non mis en cache]*',
      authorTag: message.author?.tag ?? 'Utilisateur inconnu',
      authorId: message.author?.id ?? null,
      avatarURL: message.author?.displayAvatarURL?.() ?? null,
      attachments: [...(message.attachments?.values() ?? [])].map((a) => a.url),
      timestamp: Date.now()
    });
  });

  client.on('messageUpdate', (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot) return;
    if (oldMessage.content === newMessage.content) return;
    pushEntry(editedTracker, newMessage.channel.id, {
      before: oldMessage.content || '*[vide]*',
      after: newMessage.content || '*[vide]*',
      authorTag: newMessage.author?.tag ?? 'Utilisateur inconnu',
      authorId: newMessage.author?.id ?? null,
      avatarURL: newMessage.author?.displayAvatarURL?.() ?? null,
      timestamp: Date.now()
    });
  });
}

export function getSnipe(channelId, index = 0) {
  return deletedTracker.get(channelId)?.[index] ?? null;
}

export function getEditSnipe(channelId, index = 0) {
  return editedTracker.get(channelId)?.[index] ?? null;
}
