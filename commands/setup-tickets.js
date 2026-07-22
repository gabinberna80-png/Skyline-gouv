const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets')
    .setDescription('Envoie le panneau de creation de tickets dans ce salon'),

  adminOnly: true,

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Bienvenue')
      .setDescription(
        "C'est le salon officiel pour ouvrir un ticket. Selectionnez ci-dessous la categorie correspondant a votre demande."
      )
      .setColor(0x2b2d31);

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ticket_select')
      .setPlaceholder('Fais un choix')
      .addOptions(
        config.ticketCategories.map((c) => ({
          label: c.label,
          description: c.description.slice(0, 100),
          value: c.id,
          emoji: c.emoji,
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Panneau de tickets envoye ✅', ephemeral: true });
  },
};
