require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
  PermissionFlagsBits,
  ActionRowBuilder,
  UserSelectMenuBuilder,
} = require('discord.js');
const config = require('./config');
const guildConfig = require('./guildConfig');
const {
  createTicket,
  claimTicket,
  promptCloseReason,
  closeTicket,
} = require('./ticketManager');
const serviceManager = require('./serviceManager');

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

// Liens associés à chaque document (commande /documents)
const documentLinks = {
  acte_etat_civil: 'https://canva.link/u7t9r9p83sj8qbb',
  acte_changement_identite: 'https://canva.link/898fkklsmneh1ll',
  acte_mariage: 'https://canva.link/tvkgfzcd28dwc94',
};

function isGuildAdmin(interaction) {
  const guildAdminRoleIds = guildConfig.getGuildAdminRoleIds(interaction.guildId);
  const isAdminRole = interaction.member.roles
    ? interaction.member.roles.cache.some((r) => guildAdminRoleIds.includes(r.id))
    : false;
  const hasManage = interaction.member.permissions
    ? interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    : false;
  return isAdminRole || hasManage;
}

client.once('ready', () => {
  console.log(`✅ Connecte en tant que ${client.user.tag}`);

  // Relance les rappels programmés avant un redémarrage
  const rappelCommand = client.commands.get('rappel');
  if (rappelCommand && rappelCommand.restoreReminders) {
    rappelCommand.restoreReminders(client);
  }
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
      if (interaction.customId === 'documents_select') {
        const choix = interaction.values[0];
        const lien = documentLinks[choix];
        return await interaction.reply({ content: `Voici le lien : ${lien}`, ephemeral: true });
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
      if (interaction.customId && interaction.customId.startsWith('inscription_')) {
        const cmd = client.commands.get('inscription');
        if (cmd && cmd.handleAdminResponse) return await cmd.handleAdminResponse(interaction);
      }
      // --- Panneau de service ---
      if (interaction.customId === 'service_start') {
        return await serviceManager.handleStart(interaction);
      }
      if (interaction.customId === 'service_end') {
        return await serviceManager.handleEnd(interaction);
      }
      if (interaction.customId === 'service_hours') {
        return await serviceManager.handleHours(interaction);
      }
      if (interaction.customId === 'service_reset') {
        if (!isGuildAdmin(interaction)) {
          return interaction.reply({
            content: "Vous n'avez pas la permission d'utiliser ce bouton.",
            ephemeral: true,
          });
        }
        const menu = new UserSelectMenuBuilder()
          .setCustomId('service_reset_select')
          .setPlaceholder('Choisissez le membre dont vous voulez réinitialiser les heures')
          .setMinValues(1)
          .setMaxValues(1);
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.reply({
          content: 'Sélectionnez le membre à réinitialiser :',
          components: [row],
          ephemeral: true,
        });
      }
    }

    // --- Selecteur de membre : reset des heures de service ---
    if (interaction.isUserSelectMenu()) {
      if (interaction.customId === 'service_reset_select') {
        if (!isGuildAdmin(interaction)) {
          return interaction.reply({
            content: "Vous n'avez pas la permission d'utiliser ce menu.",
            ephemeral: true,
          });
        }
        const targetUserId = interaction.values[0];
        return await serviceManager.resetUserHours(interaction, targetUserId);
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
      if (interaction.customId === 'inscription_modal') {
        const cmd = client.commands.get('inscription');
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
