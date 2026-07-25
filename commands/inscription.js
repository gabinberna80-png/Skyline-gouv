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

const INSCRIPTION_CHANNEL_ID = '1530602327126315148';
const INSCRIPTION_ROLE_ID = '1518197588476563587';

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
      .setPlaceholder('H / F')
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
    const naissanceRaw = interaction.fields.getTextInputValue('naissance').trim();
    const nationalite = interaction.fields.getTextInputValue('nationalite').trim();
    const sexe = interaction.fields.getTextInputValue('sexe').trim();

    // Sépare "1998, Paris" en anneeNaissance="1998" et lieuNaissance="Paris"
    const parts = naissanceRaw.split(',').map((p) => p.trim());
    const anneeNaissance = parts[0] || '';
    const lieuNaissance = parts[1] || '';

    const embed = new EmbedBuilder()
      .setTitle('📋 Nouvelle demande d\'inscription')
      .setColor(0x3498db)
      .addFields(
        { name: 'Prénom', value: prenom, inline: true },
        { name: 'Nom', value: nom, inline: true },
        { name: 'Année de naissance', value: anneeNaissance || 'N/A', inline: true },
        { name: 'Lieu de naissance', value: lieuNaissance || 'N/A', inline: true },
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

    const targetChannel = await interaction.client.channels
      .fetch(INSCRIPTION_CHANNEL_ID)
      .catch(() => null);

    if (!targetChannel) {
      return interaction.reply({ content: '❌ Salon de validation introuvable, contactez un admin.', ephemeral: true });
    }

    await targetChannel.send({
      content: `<@&${INSCRIPTION_ROLE_ID}>`,
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
            content: '❌ Écriture impossible (vérifie les credentials Google service account et le partage de la sheet).',
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error('INSCRIPTION SHEET ERROR:', e);
        return interaction.reply({ content: `❌ Erreur lors de l'écriture dans le sheet : ${e.message}`, ephemeral: true });
      }

      await interaction.update({
        content: '',
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
        content: '',
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
