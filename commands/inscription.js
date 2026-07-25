const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { appendCitizen } = require('../googleSheets');
const guildConfig = require('../guildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('inscription')
    .setDescription("Faire une demande d'inscription en tant que citoyen"),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('inscription_modal')
      .setTitle('Demande d\'inscription');

    const prenom = new TextInputBuilder()
      .setCustomId('prenom')
      .setLabel('Prénom')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const nom = new TextInputBuilder()
      .setCustomId('nom')
      .setLabel('Nom')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const naissance = new TextInputBuilder()
      .setCustomId('naissance')
      .setLabel('Année et lieu de naissance')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: 1998, Paris')
      .setRequired(true);

    const nationalite = new TextInputBuilder()
      .setCustomId('nationalite')
      .setLabel('Nationalité')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const sexe = new TextInputBuilder()
      .setCustomId('sexe')
      .setLabel('Sexe')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(prenom),
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(naissance),
      new ActionRowBuilder().addComponents(nationalite),
      new ActionRowBuilder().addComponents(sexe)
    );

    return interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    const prenom = interaction.fields.getTextInputValue('prenom').trim();
    const nom = interaction.fields.getTextInputValue('nom').trim();
    const naissance = interaction.fields.getTextInputValue('naissance').trim();
    const nationalite = interaction.fields.getTextInputValue('nationalite').trim();
    const sexe = interaction.fields.getTextInputValue('sexe').trim();

    const embed = new EmbedBuilder()
      .setTitle('📋 Nouvelle demande d\'inscription')
      .setColor(0x3498db)
      .addFields(
        { name: 'Prénom', value: prenom, inline: true },
        { name: 'Nom', value: nom, inline: true },
        { name: 'Naissance', value: naissance, inline: false },
        { name: 'Nationalité', value: nationalite, inline: true },
        { name: 'Sexe', value: sexe, inline: true },
        { name: 'Demandeur', value: `<@${interaction.user.id}>`, inline: false }
      )
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`inscription_accept_${interaction.user.id}`)
        .setLabel('Valider')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`inscription_refuse_${interaction.user.id}`)
        .setLabel('Refuser')
        .setStyle(ButtonStyle.Danger)
    );

    // Stocke les données temporairement sur le message pour les récupérer à la validation
    const adminChannelId = guildConfig.getInscriptionChannelId
      ? guildConfig.getInscriptionChannelId(interaction.guildId)
      : null;

    const targetChannel = adminChannelId
      ? await interaction.client.channels.fetch(adminChannelId).catch(() => null)
      : interaction.channel;

    if (!targetChannel) {
      return interaction.reply({ content: '❌ Salon de validation introuvable, contactez un admin.', ephemeral: true });
    }

    await targetChannel.send({
      embeds: [embed],
      components: [row],
    });

    return interaction.reply({
      content: '✅ Votre demande d\'inscription a été envoyée au staff pour validation.',
      ephemeral: true,
    });
  },

  async handleAdminResponse(interaction) {
    const isAccept = interaction.customId.startsWith('inscription_accept_');
    const requesterId = interaction.customId.split('_').pop();

    if (isAccept) {
      const embed = interaction.message.embeds[0];
      const getField = (name) => embed.fields.find((f) => f.name === name)?.value || '';

      const citizen = {
        prenom: getField('Prénom'),
        nom: getField('Nom'),
        naissance: getField('Naissance'),
        nationalite: getField('Nationalité'),
        sexe: getField('Sexe'),
      };

      try {
        await addCitizen(citizen);
      } catch (e) {
        console.error('INSCRIPTION SHEET ERROR:', e);
        return interaction.reply({ content: `❌ Erreur lors de l'écriture dans le sheet : ${e.message}`, ephemeral: true });
      }

      await interaction.update({
        embeds: [EmbedBuilder.from(embed).setColor(0x2ecc71).setTitle('✅ Inscription validée')],
        components: [],
      });

      const requester = await interaction.client.users.fetch(requesterId).catch(() => null);
      if (requester) {
        requester.send('✅ Votre demande d\'inscription a été validée !').catch(() => null);
      }
    } else {
      const embed = interaction.message.embeds[0];
      await interaction.update({
        embeds: [EmbedBuilder.from(embed).setColor(0xe74c3c).setTitle('❌ Inscription refusée')],
        components: [],
      });

      const requester = await interaction.client.users.fetch(requesterId).catch(() => null);
      if (requester) {
        requester.send('❌ Votre demande d\'inscription a été refusée.').catch(() => null);
      }
    }
  },
};
