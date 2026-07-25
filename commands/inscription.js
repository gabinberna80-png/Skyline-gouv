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

    const anneeNaissance = new TextInputBuilder()
      .setCustomId('anneeNaissance')
      .setLabel('Année de naissance')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const lieuNaissance = new TextInputBuilder()
      .setCustomId('lieuNaissance')
      .setLabel('Lieu de naissance')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const nationaliteSexe = new TextInputBuilder()
      .setCustomId('nationaliteSexe')
      .setLabel('Nationalité et sexe')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex: Française, F')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(prenom),
      new ActionRowBuilder().addComponents(nom),
      new ActionRowBuilder().addComponents(anneeNaissance),
      new ActionRowBuilder().addComponents(lieuNaissance),
      new ActionRowBuilder().addComponents(nationaliteSexe)
    );

    return interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    const prenom = interaction.fields.getTextInputValue('prenom').trim();
    const nom = interaction.fields.getTextInputValue('nom').trim();
    const anneeNaissance = interaction.fields.getTextInputValue('anneeNaissance').trim();
    const lieuNaissance = interaction.fields.getTextInputValue('lieuNaissance').trim();
    const nationaliteSexeRaw = interaction.fields.getTextInputValue('nationaliteSexe').trim();

    // Sépare "Française, F" en nationalite="Française" et sexe="F"
    const parts = nationaliteSexeRaw.split(',').map((p) => p.trim());
    const nationalite = parts[0] || '';
    const sexe = parts[1] || '';

    const embed = new EmbedBuilder()
      .setTitle('📋 Nouvelle demande d\'inscription')
      .setColor(0x3498db)
      .addFields(
        { name: 'Prénom', value: prenom, inline: true },
        { name: 'Nom', value: nom, inline: true },
        { name: 'Année de naissance', value: anneeNaissance, inline: true },
        { name: 'Lieu de naissance', value: lieuNaissance, inline: true },
        { name: 'Nationalité', value: nationalite || 'N/A', inline: true },
        { name: 'Sexe', value: sexe || 'N/A', inline: true },
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
        anneeNaissance: getField('Année de naissance'),
        lieuNaissance: getField('Lieu de naissance'),
        nationalite: getField('Nationalité'),
        sexe: getField('Sexe'),
        casier: '',
      };

      try {
        const success = await appendCitizen(citizen);
        if (!success) {
          return interaction.reply({
            content: '❌ Écriture impossible (vérifie GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY dans .env).',
            ephemeral: true,
          });
        }
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
