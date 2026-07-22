const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
} = require('discord.js');
const guildConfig = require('../guildConfig');

function normalizeRoleIds(input) {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value.replace(/[<@&>]/g, ''))
    .filter((value) => /^[0-9]+$/.test(value));
}

function normalizeChannelId(input) {
  const cleaned = input.trim().replace(/[<#>]/g, '');
  return /^[0-9]+$/.test(cleaned) ? cleaned : null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure ce serveur pour les RDV et l administration'),

  adminOnly: true,

  async execute(interaction) {
    const guildId = interaction.guildId;
    const current = guildConfig.getGuildConfig(guildId);

    const modal = new ModalBuilder()
      .setCustomId('setup_modal')
      .setTitle('Configuration RDV du serveur');

    const adminRolesInput = new TextInputBuilder()
      .setCustomId('setup_admin_roles')
      .setLabel('Rôles admin (IDs ou mentions)')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue((current.adminRoleIds || []).join(', '));

    const rdvChannelInput = new TextInputBuilder()
      .setCustomId('setup_rdv_channel')
      .setLabel('ID du salon RDV')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(current.rdvChannelId || '');

    const logChannelInput = new TextInputBuilder()
      .setCustomId('setup_log_channel')
      .setLabel('ID du salon de logs')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(current.logChannelId || '');

    const archiveChannelInput = new TextInputBuilder()
      .setCustomId('setup_archive_channel')
      .setLabel('ID du salon d archive')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(current.archiveChannelId || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(adminRolesInput),
      new ActionRowBuilder().addComponents(rdvChannelInput),
      new ActionRowBuilder().addComponents(logChannelInput),
      new ActionRowBuilder().addComponents(archiveChannelInput)
    );

    await interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== 'setup_modal') return;

    const guildId = interaction.guildId;
    const current = guildConfig.getGuildConfig(guildId);
    const adminRoleValue = interaction.fields.getTextInputValue('setup_admin_roles').trim();
    const rdvChannelValue = interaction.fields.getTextInputValue('setup_rdv_channel').trim();
    const logChannelValue = interaction.fields.getTextInputValue('setup_log_channel').trim();
    const archiveChannelValue = interaction.fields.getTextInputValue('setup_archive_channel').trim();

    const updates = {};
    const changed = [];

    if (adminRoleValue.length) {
      const roleIds = normalizeRoleIds(adminRoleValue);
      if (roleIds.length) {
        updates.adminRoleIds = roleIds;
        changed.push(`Rôles admin : ${roleIds.join(', ')}`);
      }
    }

    const rdvChannelId = rdvChannelValue ? normalizeChannelId(rdvChannelValue) : null;
    if (rdvChannelValue.length && rdvChannelId) {
      updates.rdvChannelId = rdvChannelId;
      changed.push(`Salon RDV : ${rdvChannelId}`);
    }

    const logChannelId = logChannelValue ? normalizeChannelId(logChannelValue) : null;
    if (logChannelValue.length && logChannelId) {
      updates.logChannelId = logChannelId;
      changed.push(`Salon de logs : ${logChannelId}`);
    }

    const archiveChannelId = archiveChannelValue ? normalizeChannelId(archiveChannelValue) : null;
    if (archiveChannelValue.length && archiveChannelId) {
      updates.archiveChannelId = archiveChannelId;
      changed.push(`Salon d archive : ${archiveChannelId}`);
    }

    if (!Object.keys(updates).length) {
      return interaction.reply({ content: 'Aucune valeur valide fournie. Utilisez des IDs ou mentions valides.', ephemeral: true });
    }

    guildConfig.setGuildConfig(guildId, updates);

    const embed = new EmbedBuilder()
      .setTitle('Configuration mise à jour')
      .setColor(0x57f287)
      .setDescription(changed.join('\n'))
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
