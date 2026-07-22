const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const guildConfig = require('../guildConfig');

const requestsFile = path.join(__dirname, '..', 'rdv-requests.json');

function loadRequests(guildId) {
  try {
    if (!fs.existsSync(requestsFile)) {
      fs.writeFileSync(requestsFile, JSON.stringify([]));
    }
    const allRequests = JSON.parse(fs.readFileSync(requestsFile, 'utf-8')) || [];
    return guildId ? allRequests.filter((request) => request.guildId === guildId) : allRequests;
  } catch (error) {
    console.error('Erreur lecture rdv-requests.json', error);
    return [];
  }
}

function saveRequests(requests) {
  try {
    fs.writeFileSync(requestsFile, JSON.stringify(requests, null, 2));
  } catch (error) {
    console.error('Erreur écriture rdv-requests.json', error);
  }
}

function addRequest(request) {
  const allRequests = loadRequests();
  allRequests.push(request);
  saveRequests(allRequests);
}

function removeRequestById(requestId) {
  const allRequests = loadRequests();
  const request = allRequests.find((req) => req.id === requestId);
  const next = allRequests.filter((req) => req.id !== requestId);
  saveRequests(next);
  return request;
}

function getRequestById(requestId) {
  const allRequests = loadRequests();
  return allRequests.find((req) => req.id === requestId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rdv')
    .setDescription('Gestion des demandes de RDV')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Publie le panneau de prise de rendez-vous')
    )
    .addSubcommand((sub) =>
      sub
        .setName('calendrier')
        .setDescription('Liste tous les RDV en attente')
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  adminOnly: true,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'calendrier') return await this.handleCalendrier(interaction);

    const targetChannel = interaction.channel;

    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({ content: 'Salon de commande introuvable. Vérifie que la commande est utilisée dans un salon textuel.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('📅 Demande de rendez-vous')
      .setDescription("Merci d'être clair et précis dans votre demande. Vous serez notifié par message privé si votre rendez-vous est accepté ou non.")
      .setColor(0x3498db)
      .setFooter({ text: 'Demande de RDV interactive par Skyline' })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('rdv_start')
      .setLabel('Demander un RDV')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await targetChannel.send({ embeds: [embed], components: [row] });
    return interaction.reply({ content: `Le panneau de RDV a été publié dans ${targetChannel}.`, ephemeral: true });
  },

  async handleCalendrier(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const requests = loadRequests(interaction.guildId).filter((r) => r.status === 'accepted');

    if (!requests.length) {
      return interaction.editReply({ content: 'Aucun RDV accepté pour le moment.' });
    }

    const embed = new EmbedBuilder()
      .setTitle('📅 Calendrier des RDV acceptés')
      .setColor(0x22b14c)
      .setFooter({ text: `${requests.length} RDV accepté(s)` })
      .setTimestamp();

    requests.slice(0, 10).forEach((req, i) => {
      embed.addFields({
        name: `#${i + 1} — ${req.userTag}`,
        value: `📆 ${req.date} à ${req.time}\n📝 ${req.reason}`,
        inline: false,
      });
    });

    if (requests.length > 10) {
      embed.addFields({ name: '...', value: `Et ${requests.length - 10} autres RDV.`, inline: false });
    }

    return interaction.editReply({ embeds: [embed] });
  },

  async handleRdvStart(interaction) {
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder()
      .setCustomId('rdv_request_modal')
      .setTitle('Demande de RDV');

    const reasonInput = new TextInputBuilder()
      .setCustomId('rdv_reason')
      .setLabel('Raison de votre RDV')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(400);

    const dateInput = new TextInputBuilder()
      .setCustomId('rdv_date')
      .setLabel('Date souhaitée (ex: 25/12/2026)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const timeInput = new TextInputBuilder()
      .setCustomId('rdv_time')
      .setLabel('Heure souhaitée (ex: 14:30)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(reasonInput),
      new ActionRowBuilder().addComponents(dateInput),
      new ActionRowBuilder().addComponents(timeInput)
    );

    return interaction.showModal(modal);
  },

  async handleModalSubmit(interaction) {
    if (interaction.customId !== 'rdv_request_modal') return;
    const reason = interaction.fields.getTextInputValue('rdv_reason');
    const date = interaction.fields.getTextInputValue('rdv_date');
    const time = interaction.fields.getTextInputValue('rdv_time');

    const requestId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const request = {
      id: requestId,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      userTag: interaction.user.tag,
      reason,
      date,
      time,
      channelId: interaction.channelId,
      channelName: interaction.channel ? interaction.channel.name || interaction.channel.id : interaction.channelId,
      createdAt: new Date().toISOString(),
    };
    addRequest(request);

    const adminMentions = (guildConfig.getGuildAdminRoleIds(interaction.guildId) || [])
      .filter((id) => id && id.length > 0)
      .map((id) => `<@&${id}>`)
      .join(' ');

    const rdvChannelId = guildConfig.getGuildRdvChannelId(interaction.guildId);
    const adminChannel = await interaction.guild.channels.fetch(rdvChannelId).catch(() => null);
    const submission = new EmbedBuilder()
      .setTitle('Nouvelle demande de RDV')
      .setColor(0x2b2d31)
      .addFields(
        { name: 'ID de demande', value: request.id, inline: true },
        { name: 'Demandeur', value: `${interaction.user}`, inline: true },
        { name: 'Salon d\'origine', value: request.channelName, inline: true },
        { name: 'Date demandée', value: date, inline: true },
        { name: 'Heure demandée', value: time, inline: true },
        { name: 'Raison', value: reason, inline: false }
      )
      .setTimestamp();

    const acceptButton = new ButtonBuilder()
      .setCustomId(`rdv_admin_accept_${request.id}`)
      .setLabel('Accepter')
      .setStyle(ButtonStyle.Success);

    const rejectButton = new ButtonBuilder()
      .setCustomId(`rdv_admin_reject_${request.id}`)
      .setLabel('Refuser')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, rejectButton);

    if (adminChannel && adminChannel.isTextBased()) {
      await adminChannel.send({ content: adminMentions || 'Admins :', embeds: [submission], components: [row] });
    } else {
      await interaction.reply({ content: 'Le canal de notification des admins est introuvable. Vérifie la configuration.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Votre demande de RDV a bien été envoyée aux admins.', ephemeral: true });
  },

  async handleAdminResponse(interaction) {
    const [,, action, requestId] = interaction.customId.split('_');
    const accepted = action === 'accept';
    const request = getRequestById(requestId);

    if (!request) {
      return interaction.reply({ content: 'Cette demande est introuvable ou a déjà été traitée.', ephemeral: true });
    }

    if (accepted) {
      const allRequests = loadRequests();
      const idx = allRequests.findIndex((r) => r.id === requestId);
      if (idx !== -1) {
        allRequests[idx].status = 'accepted';
        saveRequests(allRequests);
      }
    } else {
      removeRequestById(requestId);
    }

    const statusEmbed = new EmbedBuilder()
      .setTitle(`RDV ${accepted ? 'accepté' : 'refusé'}`)
      .setColor(accepted ? 0x22b14c : 0xd81b60)
      .addFields({ name: 'Statut', value: accepted ? 'Accepté' : 'Refusé', inline: false })
      .setFooter({ text: `Réponse fournie par ${interaction.user.tag}` })
      .setTimestamp();

    await interaction.update({ content: accepted ? 'RDV accepté.' : 'RDV refusé.', embeds: [statusEmbed], components: [] });

    const user = await interaction.client.users.fetch(request.userId).catch(() => null);
    if (!user) {
      return interaction.followUp({ content: 'Impossible de contacter l’utilisateur en message privé.', ephemeral: true });
    }

    const dmEmbed = new EmbedBuilder()
      .setTitle(`Votre demande de RDV a été ${accepted ? 'acceptée' : 'refusée'}`)
      .setColor(accepted ? 0x22b14c : 0xd81b60)
      .addFields(
        { name: 'Salon d\'origine', value: request.channelName || 'N/A', inline: true },
        { name: 'Date demandée', value: request.date || 'N/A', inline: true },
        { name: 'Heure demandée', value: request.time || 'N/A', inline: true },
        { name: 'Raison', value: request.reason || 'N/A', inline: false }
      )
      .setTimestamp();

    await user.send({ embeds: [dmEmbed] }).catch(() => {
      interaction.followUp({ content: 'L’utilisateur n’a pas pu être contacté en DM.', ephemeral: true });
    });
  }
};