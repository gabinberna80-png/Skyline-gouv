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
        "Besoin d'aide, d'une information ou vous souhaitez signaler quelque chose hors RP ? Ouvrez un ticket ci-dessous."
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
