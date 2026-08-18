const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

// ============================================================
// Gestionnaire du systeme de tickets HRP par MP (ModMail)
//
// Principe :
// - L'utilisateur envoie un MP au bot
// - Un salon prive est cree automatiquement dans la categorie
//   configuree (cote staff)
// - Les messages du staff dans ce salon sont renvoyes en MP
// - Un bouton permet de fermer le ticket (supprime le salon)
//
// Configuration requise (variables d'environnement, fichier .env) :
//   MODMAIL_GUILD_ID       -> ID du serveur ou creer les tickets
//   MODMAIL_CATEGORY_ID    -> ID de la categorie HRP qui recevra les salons
//   MODMAIL_STAFF_ROLE_ID  -> (optionnel) role staff ping + acces au salon
// ============================================================

const MODMAIL_GUILD_ID = process.env.MODMAIL_GUILD_ID;
const MODMAIL_CATEGORY_ID = process.env.MODMAIL_CATEGORY_ID;
const MODMAIL_STAFF_ROLE_ID = process.env.MODMAIL_STAFF_ROLE_ID; // optionnel

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'dmTickets.json');

// --- Persistance (survit aux redemarrages du bot) ---
function loadTickets() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '{}');
  } catch (err) {
    console.error('Impossible de charger dmTickets.json:', err);
    return {};
  }
}

function saveTickets() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2), 'utf8');
  } catch (err) {
    console.error('Impossible de sauvegarder dmTickets.json:', err);
  }
}

// tickets: { [userId]: { channelId } }
let tickets = loadTickets();
let channelToUser = {};
rebuildReverseMap();

function rebuildReverseMap() {
  channelToUser = {};
  for (const [userId, data] of Object.entries(tickets)) {
    channelToUser[data.channelId] = userId;
  }
}

function isTicketChannel(channelId) {
  return Boolean(channelToUser[channelId]);
}

function buildCloseRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('dm_ticket_close')
      .setLabel('Fermer le ticket')
      .setStyle(ButtonStyle.Danger)
  );
}

// --- Recupere le salon existant du user, ou en cree un nouveau ---
async function getOrCreateChannel(client, user) {
  const existing = tickets[user.id];
  if (existing) {
    const guild = client.guilds.cache.get(MODMAIL_GUILD_ID);
    const channel = guild ? guild.channels.cache.get(existing.channelId) : null;
    if (channel) return channel;
    // Le salon a ete supprime manuellement : on nettoie et on en recree un
    delete tickets[user.id];
    saveTickets();
    rebuildReverseMap();
  }

  const guild = client.guilds.cache.get(MODMAIL_GUILD_ID);
  if (!guild) {
    throw new Error('MODMAIL_GUILD_ID introuvable ou invalide (le bot est-il bien sur ce serveur ?).');
  }
  const category = MODMAIL_CATEGORY_ID ? guild.channels.cache.get(MODMAIL_CATEGORY_ID) : null;

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
  ];
  if (MODMAIL_STAFF_ROLE_ID) {
    overwrites.push({
      id: MODMAIL_STAFF_ROLE_ID,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
    });
  }

  const channelName = `mp-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category ? category.id : undefined,
    permissionOverwrites: overwrites,
    topic: `Ticket MP ouvert par ${user.tag} (${user.id})`,
  });

  tickets[user.id] = { channelId: channel.id };
  saveTickets();
  rebuildReverseMap();

  const introEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Nouveau ticket MP')
    .setDescription(
      `Utilisateur : **${user.tag}** (${user.id})\nRepondez directement dans ce salon, vos messages seront transmis en MP.`
    )
    .setTimestamp();

  await channel.send({
    content: MODMAIL_STAFF_ROLE_ID ? `<@&${MODMAIL_STAFF_ROLE_ID}>` : undefined,
    embeds: [introEmbed],
    components: [buildCloseRow()],
  });

  return channel;
}

// --- MP utilisateur -> salon staff ---
async function handleDirectMessage(client, message) {
  if (!message.content && message.attachments.size === 0) return;

  let channel;
  try {
    channel = await getOrCreateChannel(client, message.author);
  } catch (err) {
    console.error('Erreur creation ticket MP:', err);
    return message
      .reply("Le systeme de tickets n'est pas correctement configure, contactez le staff autrement.")
      .catch(() => null);
  }

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || null)
    .setTimestamp();

  const files = [...message.attachments.values()].map((a) => a.url);

  try {
    await channel.send({ embeds: [embed], files: files.length ? files : undefined });
    await message.react('✅').catch(() => null);
  } catch (err) {
    console.error('Erreur relais MP -> salon:', err);
  }
}

// --- Salon staff -> MP utilisateur ---
async function handleStaffReply(message) {
  const userId = channelToUser[message.channel.id];
  if (!userId) return;
  if (!message.content && message.attachments.size === 0) return;

  try {
    const user = await message.client.users.fetch(userId);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: 'Reponse du staff', iconURL: message.guild.iconURL() || undefined })
      .setDescription(message.content || null)
      .setTimestamp();

    const files = [...message.attachments.values()].map((a) => a.url);
    await user.send({ embeds: [embed], files: files.length ? files : undefined });
    await message.react('📨').catch(() => null);
  } catch (err) {
    console.error('Erreur relais salon -> MP:', err);
    await message.reply("Impossible d'envoyer le message a l'utilisateur (MP fermes ?).").catch(() => null);
  }
}

// --- Fermeture du ticket (bouton "Fermer le ticket") ---
async function closeTicket(interaction) {
  const userId = channelToUser[interaction.channel.id];
  if (!userId) {
    return interaction.reply({ content: "Ce salon n'est pas un ticket MP actif.", ephemeral: true });
  }

  await interaction.reply({ content: 'Fermeture du ticket en cours...', ephemeral: true });

  try {
    const user = await interaction.client.users.fetch(userId);
    await user
      .send('🔒 Votre ticket a ete ferme par le staff. Vous pouvez en ouvrir un nouveau en nous envoyant un nouveau message.')
      .catch(() => null);
  } catch (err) {
    console.error('Erreur notification fermeture:', err);
  }

  delete tickets[userId];
  saveTickets();
  rebuildReverseMap();

  await interaction.channel.delete().catch((err) => console.error('Erreur suppression salon:', err));
}

module.exports = {
  handleDirectMessage,
  handleStaffReply,
  closeTicket,
  isTicketChannel,
};
