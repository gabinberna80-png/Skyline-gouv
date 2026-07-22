require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Partials, PermissionFlagsBits } = require('discord.js');
const config = require('./config');
const guildConfig = require('./guildConfig');
const {
  createTicket,
  claimTicket,
  promptCloseReason,
  closeTicket,
} = require('./ticketManager');

const client = new Client({
  intents: [
    // Pour démarrer sans permissions privilégiées, n'inclure que les intents non-priviliégés.
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

// Chargement des commandes slash
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'))) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`✅ Connecte en tant que ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  try {
    // --- Commandes slash ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      // If command is adminOnly, ensure the user has one of the admin roles or ManageGuild permission
      if (command.adminOnly) {
        const guildAdminRoleIds = guildConfig.getGuildAdminRoleIds(interaction.guildId);
        const isAdminRole = interaction.member.roles ? interaction.member.roles.cache.some((r) => guildAdminRoleIds.includes(r.id)) : false;
        const hasManage = interaction.member.permissions ? interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) : false;
        if (!isAdminRole && !hasManage) {
          return interaction.reply({ content: "Vous n'avez pas la permission d'utiliser cette commande.", ephemeral: true });
        }
      }

      // If command has allowedRoleIds then ensure the user has one of those roles
      if (command.allowedRoleIds && Array.isArray(command.allowedRoleIds) && command.allowedRoleIds.length > 0) {
        const hasAllowedRole = interaction.member.roles
          ? interaction.member.roles.cache.some((r) => command.allowedRoleIds.includes(r.id))
          : false;
        if (!hasAllowedRole) {
          return interaction.reply({ content: "Vous n'avez pas le rôle nécessaire pour utiliser cette commande.", ephemeral: true });
        }
      }

      return await command.execute(interaction);
    }

    // --- Menu deroulant : choix de la categorie de ticket ---
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'ticket_select') {
        const categoryId = interaction.values[0];
        return await createTicket(interaction, categoryId);
      }
      if (interaction.customId === 'stp_category_select' || interaction.customId.startsWith('stp_action_select')) {
        const cmd = client.commands.get('setup-tickets-plus');
        if (!cmd) return;
        if (interaction.customId === 'stp_category_select') return await cmd.handleCategorySelect(interaction);
        if (interaction.customId.startsWith('stp_action_select')) return await cmd.handleActionSelect(interaction);
      }
    }

    // --- Boutons dans un ticket et RDV ---
    if (interaction.isButton()) {
      if (interaction.customId === 'ticket_claim') {
        return await claimTicket(interaction);
      }
      if (interaction.customId === 'ticket_close') {
        return await promptCloseReason(interaction);
      }
      if (interaction.customId === 'rdv_start') {
        const cmd = client.commands.get('rdv');
        if (cmd && cmd.handleRdvStart) return await cmd.handleRdvStart(interaction);
      }
      if (interaction.customId && interaction.customId.startsWith('rdv_admin_')) {
        const cmd = client.commands.get('rdv');
        if (cmd && cmd.handleAdminResponse) return await cmd.handleAdminResponse(interaction);
      }
    }

    // --- Modales ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'ticket_close_modal') {
        const reason = interaction.fields.getTextInputValue('close_reason');
        return await closeTicket(interaction, reason);
      }
      if (interaction.customId && interaction.customId.startsWith && (interaction.customId.startsWith('stp_edit_message_modal') || interaction.customId.startsWith('stp_edit_roles_modal'))) {
        const cmd = client.commands.get('setup-tickets-plus');
        if (cmd && cmd.handleModalSubmit) return await cmd.handleModalSubmit(interaction);
      }
      if (interaction.customId === 'rdv_request_modal') {
        const cmd = client.commands.get('rdv');
        if (cmd && cmd.handleModalSubmit) return await cmd.handleModalSubmit(interaction);
      }
      if (interaction.customId === 'setup_modal') {
        const cmd = client.commands.get('setup');
        if (cmd && cmd.handleModalSubmit) return await cmd.handleModalSubmit(interaction);
      }
    }
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      interaction
        .reply({ content: "Une erreur est survenue, contactez l'administrateur.", ephemeral: true })
        .catch(() => null);
    }
  }
});

client.on('error', (error) => {
  console.error('Client error:', error);
});

client.on('shardError', (error) => {
  console.error('Shard error:', error);
});

client.login(process.env.DISCORD_TOKEN);
