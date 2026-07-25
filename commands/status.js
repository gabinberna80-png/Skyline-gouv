const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const activityTypes = {
  joue: 0,      // Playing
  ecoute: 2,    // Listening
  regarde: 3,   // Watching
  concurrence: 5, // Competing
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('Change le statut du bot')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Type de statut')
        .setRequired(true)
        .addChoices(
          { name: 'Joue à', value: 'joue' },
          { name: 'Écoute', value: 'ecoute' },
          { name: 'Regarde', value: 'regarde' },
          { name: 'En compétition', value: 'concurrence' },
        )
    )
    .addStringOption((option) =>
      option.setName('texte').setDescription('Le texte du statut').setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('presence')
        .setDescription('État de présence')
        .addChoices(
          { name: 'En ligne', value: 'online' },
          { name: 'Absent', value: 'idle' },
          { name: 'Ne pas déranger', value: 'dnd' },
          { name: 'Invisible', value: 'invisible' },
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  adminOnly: true,
  async execute(interaction) {
    const type = interaction.options.getString('type');
    const texte = interaction.options.getString('texte');
    const presence = interaction.options.getString('presence') || 'online';

    try {
      interaction.client.user.setPresence({
        activities: [{ name: texte, type: activityTypes[type] }],
        status: presence,
      });

      return interaction.reply({
        content: `✅ Statut mis à jour : **${type} ${texte}** (${presence})`,
        ephemeral: true,
      });
    } catch (e) {
      console.error('STATUS ERROR:', e);
      return interaction.reply({ content: `❌ Erreur : ${e.message}`, ephemeral: true });
    }
  },
};
