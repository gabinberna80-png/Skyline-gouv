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
    .setName('setup-service')
    .setDescription('Envoie le panneau de prise de service dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🕒 Panneau de service')
      .setDescription(
        'Utilisez les boutons ci dessous pour prendre ou retirez votre service. Pensez-y !'
      )
      .setColor(0x2b2d31);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('service_start')
        .setLabel('Prise de service')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢'),
      new ButtonBuilder()
        .setCustomId('service_end')
        .setLabel('Fin de service')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔴'),
      new ButtonBuilder()
        .setCustomId('service_hours')
        .setLabel('Heures totales')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊')
    );

    await interaction.channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: 'Panneau de service envoyé ✅', ephemeral: true });
  },
};
