const {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const configPath = path.join(__dirname, '..', 'config.js');
let config = require(configPath);

function saveConfig(newConfig) {
  const content = 'module.exports = ' + JSON.stringify(newConfig, null, 2) + '\n';
  fs.writeFileSync(configPath, content, { encoding: 'utf8' });
  delete require.cache[require.resolve(configPath)];
  config = require(configPath);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets-plus')
    .setDescription("Assistant de configuration avancée des tickets"),

  adminOnly: true,

  async execute(interaction) {
    const categories = (config.ticketCategories || []).map((c) => ({ label: c.label, description: c.description.slice(0, 100), value: c.id }));
    if (!categories.length) return interaction.reply({ content: 'Aucune catégorie configurée.', ephemeral: true });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('stp_category_select')
      .setPlaceholder('Choisissez une catégorie')
      .addOptions(...categories);

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.reply({ content: 'Sélectionnez la catégorie à configurer :', components: [row], ephemeral: true });
  },

  // Component handlers
  async handleCategorySelect(interaction) {
    const categoryId = interaction.values[0];
    const cat = config.ticketCategories.find((c) => c.id === categoryId);
    if (!cat) return interaction.reply({ content: 'Catégorie introuvable.', ephemeral: true });

    const actions = [
      { label: 'Modifier l\'embed d\'accueil', value: 'personalize_embed', description: 'Modifier le message d\'ouverture du panel' },
      { label: 'Modifier les rôles à ping', value: 'edit_ping_roles', description: 'Définir les rôles notifiés à l\'ouverture du ticket' },
    ];

    const menu = new StringSelectMenuBuilder()
      // encode the category id into the customId so we reliably know which category is targeted
      .setCustomId(`stp_action_select:${categoryId}`)
      .setPlaceholder(`Actions pour ${cat.label}`)
      .addOptions(...actions);

    const row = new ActionRowBuilder().addComponents(menu);
    await interaction.update({ content: `Catégorie sélectionnée : **${cat.label}** — choisissez une action :`, components: [row] });
  },

  async handleActionSelect(interaction) {
    const action = interaction.values[0];
    // parse categoryId from customId 'stp_action_select:{categoryId}'
    const parts = interaction.customId ? interaction.customId.split(':') : [];
    const categoryId = parts.length > 1 ? parts[1] : null;
    // Retrieve the previous message to determine the selected category from the content as fallback
    const content = interaction.message.content || '';
    const m = content.match(/Catégorie sélectionnée : \*\*(.*)\*\*/);
    const categoryLabel = m ? m[1] : null;
    const cat = (config.ticketCategories || []).find((c) => c.id === categoryId) || (config.ticketCategories || []).find((c) => c.label === categoryLabel) || (config.ticketCategories || []).find((c) => c.id === interaction.values[0]);

    if (!cat) return interaction.reply({ content: 'Catégorie introuvable.', ephemeral: true });

    if (action === 'personalize_embed') {
      const modal = new ModalBuilder().setCustomId(`stp_edit_message_modal:${categoryId}`).setTitle('Modifier le message du panel');
      const input = new TextInputBuilder()
        .setCustomId('embed_message')
        .setLabel('Message d\'ouverture')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setValue(cat ? (cat.openingText || '') : '');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    if (action === 'edit_ping_roles') {
      const modal = new ModalBuilder().setCustomId(`stp_edit_roles_modal:${categoryId}`).setTitle('Modifier les rôles à ping');
      const input = new TextInputBuilder()
        .setCustomId('ping_roles')
        .setLabel('IDs des rôles (virgule séparées)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(cat && Array.isArray(cat.staffRoleIds) ? cat.staffRoleIds.join(', ') : '');
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    return interaction.reply({
      content: 'Cette action n\'est plus disponible. Relancez `/setup-tickets-plus` pour voir les options actuelles.',
      flags: 64,
    });
  },

  async handleModalSubmit(interaction) {
    const parts = interaction.customId ? interaction.customId.split(':') : [];
    const type = parts[0];
    const categoryId = parts.length > 1 ? parts[1] : null;

    if (!categoryId) {
      return interaction.reply({ content: 'Impossible de déterminer la catégorie ciblée.', ephemeral: true });
    }

    const idx = (config.ticketCategories || []).findIndex((c) => c.id === categoryId);
    if (idx === -1) return interaction.reply({ content: 'Catégorie introuvable.', ephemeral: true });

    if (type === 'stp_edit_message_modal') {
      const message = interaction.fields.getTextInputValue('embed_message');
      config.ticketCategories[idx].openingText = message;
      saveConfig(config);
      return interaction.reply({ content: "Message d'ouverture mis à jour pour la catégorie.", ephemeral: true });
    }

    if (type === 'stp_edit_roles_modal') {
      const rolesValue = interaction.fields.getTextInputValue('ping_roles');
      const roleIds = rolesValue
        .split(',')
        .map((roleId) => roleId.trim())
        .filter((roleId) => roleId.length > 0);
      config.ticketCategories[idx].staffRoleIds = roleIds;
      saveConfig(config);
      return interaction.reply({ content: 'Rôles à ping mis à jour pour la catégorie.', ephemeral: true });
    }

    return interaction.reply({ content: 'Type de modale inconnu.', ephemeral: true });
  },
};
