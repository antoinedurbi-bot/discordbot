# Discord Protect Bot

Bot de protection anti-raid / anti-nuke / anti-spam pour Discord, conçu pour réagir en quelques secondes face à des attaques coordonnées (raid de masse, nuke de serveur, spam de webhooks/invitations).

## Fonctionnalités

- **Anti-Nuke** : surveille les journaux d'audit en temps réel (suppression/création de salons et rôles, bans, kicks, création de webhooks, ajout de bots, attribution du rôle Administrateur). Si un compte non whitelisté dépasse le seuil d'actions destructrices dans une fenêtre de temps, il est automatiquement sanctionné (retrait des rôles dangereux, kick ou ban selon la config).
- **Anti-Raid** : détecte les vagues d'arrivées massives et déclenche un verrouillage automatique du serveur (fermeture de l'envoi de messages/connexion vocale, passage en vérification maximale). Les comptes trop récents créés pendant une vague sont expulsés.
- **Anti-Spam** : limite le flood de messages, les spams de mentions, les messages dupliqués et les liens d'invitation non autorisés, avec sanction automatique (timeout/kick/ban).
- **Anti-Alt** (opt-in) : filtre à l'arrivée les comptes trop récents et/ou sans avatar personnalisé.
- **Anti-Phishing** : détecte et bloque les liens de phishing connus (faux Nitro, faux Steam...) avec sanction automatique.
- **Vérification à l'arrivée** : bouton "Je ne suis pas un bot" avant d'accéder au serveur (rôle non-vérifié → rôle membre).
- **Panic Button** (`/panic`) : verrouille instantanément tout le serveur en une commande.
- **Whitelist** : les admins de confiance (et les owners définis en `.env`) sont toujours exemptés des sanctions automatiques.
- **Backup/Restore** : sauvegarde la structure des rôles et permet de restaurer rapidement après un incident.
- **Avertissements** : système de warns persistant par membre, avec historique consultable.
- **Bienvenue/Départ & Auto-role** : messages personnalisables et attribution automatique de rôle à l'arrivée.
- **Modération de salon** : lock/unlock et slowmode ciblés sur un salon précis.
- **Snipe** : retrouve le dernier message supprimé/édité d'un salon.
- **Statistiques** : arrivées/départs du jour, nombre de warns et d'incidents de sécurité.
- **Chat IA** : discute avec le bot (Claude) via `*ai <message>` ou en le mentionnant, avec mémoire de conversation par salon.
- **Logs de sécurité** : toutes les alertes sont envoyées dans un salon dédié et conservées en historique.

## Installation

```bash
npm install
cp .env.example .env
```

Renseigne dans `.env` :
- `DISCORD_TOKEN` : token du bot (Developer Portal > Bot)
- `CLIENT_ID` : ID de l'application
- `GUILD_ID` : ID de ton serveur (déploiement instantané des commandes, recommandé)
- `OWNER_IDS` : tes IDs Discord (séparés par des virgules) — toujours protégés
- `ANTHROPIC_API_KEY` (optionnel) : clé API [console.anthropic.com](https://console.anthropic.com) pour activer le chat IA (`*ai`)

### Permissions et intents requis

Dans le Developer Portal, active les **Privileged Gateway Intents** :
- Server Members Intent
- Message Content Intent

Invite le bot avec les permissions : Administrateur (recommandé pour un anti-nuke efficace), ou a minima : Gérer les rôles, Gérer les salons, Expulser/Bannir des membres, Gérer les webhooks, Gérer le serveur.

### Déploiement des commandes slash

```bash
npm run deploy
```

### Lancement

```bash
npm start
```

## Commandes principales

Les commandes sont disponibles en **slash `/`** et en **préfixe `*`** (avec alias courts).

| Commande | Alias | Description |
|---|---|---|
| `/panic` \| `*panic` | `*p` | Verrouille immédiatement le serveur |
| `/unlock` \| `*unlock` | `*u` | Lève le verrouillage |
| `/status` \| `*status` | `*s` | Affiche l'état de la protection |
| `/whitelist add/remove/list` \| `*whitelist` | `*wl` | Gère les membres protégés |
| `/setlogchannel` \| `*setlog` | `*log` | Définit le salon des alertes |
| `/config antinuke\|antiraid\|antispam` | — | Ajuste les seuils de détection |
| `/backup` \| `*backup` | `*bk` | Sauvegarde la structure du serveur |
| `/restore` \| `*restore` | `*rs` | Restaure les rôles depuis la dernière sauvegarde |
| `*snipe` | `*sn` | Affiche le dernier message supprimé du salon |
| `*editsnipe` | `*es` | Affiche le dernier message édité du salon |
| `*clear <n>` | `*c` | Supprime en masse jusqu'à 100 messages |
| `*kick @membre [raison]` | `*k` | Expulse un membre |
| `*ban @membre [raison]` | `*b` | Bannit un membre |
| `*unban <id>` | `*ub` | Débannit un utilisateur |
| `*mute @membre <minutes> [raison]` | `*m` | Timeout un membre |
| `*unmute @membre` | `*um` | Retire le timeout |
| `*userinfo [@membre]` | `*ui` | Infos d'un membre |
| `*serverinfo` | `*si` | Infos du serveur |
| `*avatar [@membre]` | `*av` | Affiche l'avatar en grand |
| `*ping` | — | Latence du bot |
| `*warn @membre <raison>` | `*w` | Ajoute un avertissement |
| `*warnings @membre` | `*ws` | Liste les avertissements |
| `*clearwarns @membre` | `*cw` | Efface les avertissements |
| `*antialt on\|off` | `*aa` | Filtre les comptes suspects à l'arrivée |
| `*antiphishing on\|off` | `*ap` | Active/désactive la détection de phishing |
| `*require2fa on\|off` | `*2fa` | Exige la 2FA pour la modération (si l'API l'autorise) |
| `*verify #salon @role_non_vérifié [@role_membre]` | `*v` | Met en place la vérification à l'arrivée |
| `*welcome #salon <message>` \| `*welcome off` | `*wc` | Message de bienvenue ({user}, {server}) |
| `*leave #salon <message>` \| `*leave off` | `*lv` | Message de départ |
| `*autorole @role` \| `*autorole off` | `*ar` | Rôle automatique à l'arrivée |
| `*lockchannel [#salon]` | `*lc` | Verrouille un salon précis |
| `*unlockchannel [#salon]` | `*ulc` | Déverrouille un salon précis |
| `*slowmode <secondes> [#salon]` | `*sm` | Définit le mode lent d'un salon |
| `*stats` | `*st` | Statistiques du serveur |
| `*embed` | `*em` | Formulaire simple (titre, texte, couleur) → envoie une image PNG stylée (texte non copiable) |
| `*ai <message>` (ou mentionner le bot) | `*ask` | Discute avec l'IA du bot, accessible à tous les membres |
| `*help` | `*h` | Liste paginée de toutes les commandes |

## Conseils face à des attaquants expérimentés

1. **Donne au bot un rôle très haut placé** (juste sous le tien) pour qu'il puisse retirer les permissions de comptes compromis avant qu'ils n'agissent.
2. **Whitelist uniquement les comptes de confiance stricte** — chaque admin non whitelisté est surveillé par l'anti-nuke.
3. **Active l'authentification à 2 facteurs obligatoire** pour la modération (Paramètres serveur > Modération).
4. **Fais un `/backup` régulièrement**, surtout avant tout changement de structure important.
5. **Active le mode panique préventivement** (`/panic`) si une attaque est annoncée, puis lève-le une fois la menace passée.
