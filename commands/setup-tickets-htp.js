const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup-tickets-hrp')
    .setDescription('Envoie le panneau de creation de ticket HRP dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('Ticket HRP')
      .setDescription(
        "Si vous avez besoin d'aide ou d'une information merci d'ouvrir un ticket, merci également de restez poli et claire dans vos demande"
      )
      .setColor(0x2b2d31);

    const button = new ButtonBuilder()
      .setCustomId('ticket_hrp_open')
      .setLabel('Ouvrir un ticket HRP')
      .setEmoji('💬')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Panneau de ticket HRP envoye ✅', ephemeral: true });
  },
};
