# Bot Discord — Systeme de tickets + archivage

Bot avec :
- Un menu deroulant de creation de tickets (identique a ta capture : Boutique, Support, RC Staff / CM, Illegal, Legal) **+** 5 categories de recrutement (DOJ, Secretaire d'Etat, Cabinet du Gouverneur, Cabinet Avocat LS, Gouvernance Principale).
- Un salon prive cree automatiquement par ticket, avec boutons **Prendre en charge** et **Fermer le ticket**.
- Un systeme d'archivage : a la fermeture, un transcript HTML complet de la conversation est genere et poste dans un **fil dedie** du salon d'archives (facile a retrouver/rechercher), et un fil "logs" recoit en direct chaque ouverture/prise en charge/fermeture.

## 1. Installation

```bash
npm install
```

## 2. Configuration

1. Copie `.env.example` en `.env` et remplis :
   - `DISCORD_TOKEN` : le token du bot (Developer Portal > Bot > Reset Token)
   - `CLIENT_ID` : l'ID de l'application (Developer Portal > General Information)
   - `GUILD_ID` : l'ID de ton serveur
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` : l'adresse email du compte de service Google
   - `GOOGLE_PRIVATE_KEY` : la clé privée du compte de service, avec les retours à la ligne sous forme `\n`
   - `GOOGLE_SPREADSHEET_ID` : l'ID du fichier Google Sheets
   - `GOOGLE_SHEET_TITLE` : le nom de l'onglet (optionnel, par défaut `RDV`)
   - `GOOGLE_API_KEY` : (optionnel) clé API publique — permet uniquement la lecture si le sheet est public

2. Ouvre `config.js` et remplace toutes les valeurs `METTRE_ICI_...` par les vrais IDs :
   - `logChannelId` : salon ou seront postes les logs en direct
   - `archiveChannelId` : salon "Archives" (les transcripts y seront postes sous forme de fils)
   - `adminRoleIds` : role(s) staff/admin ayant acces a tous les tickets
   - Pour chaque categorie (`ticketCategories`) : `discordCategoryId` (la categorie Discord dans laquelle le salon du ticket sera cree) et `staffRoleIds` (role(s) pings/acces pour cette categorie)

   Astuce : les 5 categories de recrutement peuvent toutes pointer vers la meme categorie Discord "Recrutement" si tu preferes, il suffit de mettre le meme `discordCategoryId` partout.

3. Le bot doit avoir les permissions : `Gerer les salons`, `Gerer les fils`, `Envoyer des messages`, `Joindre des fichiers`, `Voir les salons`.

## 3. Deploiement des commandes slash

```bash
npm run deploy
```

## 4. Lancement du bot

```bash
npm start
```

## 5. Utilisation

Dans le salon ou tu veux afficher le panneau (ex: `#creer-un-ticket`), tape :

```
/setup-tickets
```

Cela poste l'embed + le menu deroulant "Fais un choix", exactement comme sur ta capture.

## Fonctionnement de l'archivage

- **Logs en direct** (`logChannelId`) : une ligne a chaque ouverture, prise en charge et fermeture de ticket (qui, quoi, quand).
- **Archives** (`archiveChannelId`) : a la fermeture, un fil est cree avec le nom du ticket. Il contient le fichier `.html` du transcript complet (messages, pieces jointes) + un embed recap (categorie, ouvert par, ferme par, raison). Comme ce sont des fils, tu peux les archiver/rouvrir et les retrouver via la recherche Discord — beaucoup plus lisible qu'un simple fichier perdu dans un salon.
- Le salon du ticket est automatiquement supprime quelques secondes apres la fermeture (delai reglable via `deleteDelaySeconds`).

## Pour la suite

Structure prevue pour ajouter facilement :
- Limitation du nombre de tickets ouverts par utilisateur (deja partiellement geree par categorie)
- Statistiques de tickets (nombre par categorie, temps de reponse moyen)
- Boutons supplementaires (ex: "Ajouter un membre au ticket")

Dis-moi quand tu veux qu'on enchaine dessus.

## Dépannage

- Erreur fréquente à la console: `DiscordjsError [TokenInvalid]: An invalid token was provided.`
   - Signifie que la variable d'environnement `DISCORD_TOKEN` est absente ou incorrecte.
   - Solution rapide (PowerShell) :

```powershell
$env:DISCORD_TOKEN = 'VOTRE_TOKEN_ICI'
npm run start
```

- Pour une configuration permanente, créez un fichier `.env` à la racine (ne le commitez pas) :

```
DISCORD_TOKEN=VOTRE_TOKEN_ICI
```

- Vérifiez aussi que le token est bien celui du bot (Developer Portal → Bot → Token) et qu'il n'a pas été réinitialisé.
