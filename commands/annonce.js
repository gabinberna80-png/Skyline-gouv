const { SlashCommandBuilder, ChannelType } = require('discord.js');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('annonce')
    .setDescription('Publie une annonce écrite par vous dans un salon.')
    .addStringOption((option) =>
      option
        .setName('message')
        .setDescription('Le texte de l’annonce')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('salon')
        .setDescription('Salon où envoyer l’annonce (par défaut : salon actuel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  adminOnly: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('salon') || interaction.channel;

    if (!channel || !channel.isTextBased()) {
      return interaction.editReply({ content: 'Salon invalide ou non textuel.' });
    }

    try {
      await channel.send({ content: message });
      return interaction.editReply({ content: `Annonce envoyée dans ${channel}.` });
    } catch (error) {
      console.error('Erreur lors de l envoi de l annonce :', error);
      return interaction.editReply({ content: 'Impossible d envoyer l annonce dans ce salon.' });
    }
  },
};
