const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const transcripts = require('discord-html-transcripts');
const config = require('./config');
const guildConfig = require('./guildConfig');

const COLOR_MAIN = 0x2b2d31;
const COLOR_SUCCESS = 0x57f287;
const COLOR_DANGER = 0xed4245;
const COLOR_INFO = 0x5865f2;

/** Nettoie un pseudo pour en faire un nom de salon valide */
function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
}

function findCategoryById(id) {
  return config.ticketCategories.find((c) => c.id === id);
}

/** Envoie une ligne dans le salon de logs "en direct" */
async function pushLog(guild, { title, description, color = COLOR_INFO, fields = [] }) {
  const logChannelId = guildConfig.getGuildLogChannelId(guild.id);
  if (!logChannelId || logChannelId.startsWith('METTRE_ICI')) return;
  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();

  if (fields.length) embed.addFields(fields);

  await logChannel.send({ embeds: [embed] }).catch(() => null);
}

/**
 * Cree un ticket : salon prive dans la bonne categorie Discord,
 * permissions ciblees, embed de bienvenue + boutons de gestion.
 */
async function createTicket(interaction, categoryId) {
  const category = findCategoryById(categoryId);
  if (!category) {
    return interaction.reply({ content: 'Categorie de ticket introuvable.', ephemeral: true });
  }

  const guild = interaction.guild;
  const member = interaction.member;

  // Empeche un utilisateur d'avoir 2 tickets ouverts pour la meme categorie
  const existing = guild.channels.cache.find(
    (ch) => ch.topic === `ticket:${category.id}:${member.id}`
  );
  if (existing) {
    return interaction.reply({
      content: `Vous avez deja un ticket ouvert ici : ${existing}`,
      ephemeral: true,
    });
  }

  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
  ];

  for (const roleId of [...(category.staffRoleIds || []), ...(guildConfig.getGuildAdminRoleIds(guild.id) || [])]) {
    if (!roleId || roleId.startsWith('METTRE_ICI')) continue;
    overwrites.push({
      id: roleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages,
      ],
    });
  }

  let parentId = category.discordCategoryId && !category.discordCategoryId.startsWith('METTRE_ICI')
    ? category.discordCategoryId
    : undefined;
  // Vérifie que l'ID de catégorie fourni est bien une catégorie Discord valide
  if (parentId) {
    const parentChannel = guild.channels.cache.get(parentId);
    if (!parentChannel || parentChannel.type !== ChannelType.GuildCategory) {
      // Ne pas utiliser parentId s'il ne s'agit pas d'une catégorie
      console.warn(`Configured discordCategoryId ${parentId} is not a category in guild ${guild.id}`);
      parentId = undefined;
    }
  }

  const channel = await guild.channels.create({
    name: `${category.emoji ? '' : ''}ticket-${slugify(category.label)}-${slugify(member.user.username)}`,
    type: ChannelType.GuildText,
    parent: parentId,
    topic: `ticket:${category.id}:${member.id}`,
    permissionOverwrites: overwrites,
  });

  const welcomeEmbed = new EmbedBuilder()
    .setTitle(`${category.emoji || '🎫'} ${category.label}`)
    .setDescription(category.openingText || `Ticket ouvert par ${member}.`)
    .addFields(
      { name: 'Ouvert par', value: `${member}`, inline: true },
      { name: 'Categorie', value: category.label, inline: true }
    )
    .setColor(COLOR_MAIN)
    .setTimestamp();

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_claim')
      .setLabel('Prendre en charge')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger)
  );

  const staffMentions = [...(category.staffRoleIds || [])]
    .filter((r) => r && !r.startsWith('METTRE_ICI'))
    .map((r) => `<@&${r}>`)
    .join(' ');

  await channel.send({
    content: `${member} ${staffMentions}`.trim(),
    embeds: [welcomeEmbed],
    components: [buttons],
  });

  await interaction.reply({
    content: `Votre ticket a ete cree : ${channel}`,
    ephemeral: true,
  });

  await pushLog(guild, {
    title: '🟢 Ticket ouvert',
    description: `${member} a ouvert un ticket **${category.label}**.`,
    color: COLOR_SUCCESS,
    fields: [
      { name: 'Salon', value: `${channel}`, inline: true },
      { name: 'Categorie', value: category.label, inline: true },
    ],
  });
}

/** Un membre du staff s'assigne le ticket */
async function claimTicket(interaction) {
  const channel = interaction.channel;
  const embed = new EmbedBuilder()
    .setDescription(`🙋 Ce ticket est desormais pris en charge par ${interaction.user}.`)
    .setColor(COLOR_INFO);

  await interaction.reply({ embeds: [embed] });

  await pushLog(interaction.guild, {
    title: '🙋 Ticket pris en charge',
    description: `${interaction.user} a pris en charge le ticket ${channel}.`,
    color: COLOR_INFO,
  });
}

/** Ouvre une modale demandant la raison de fermeture */
async function promptCloseReason(interaction) {
  const modal = new ModalBuilder().setCustomId('ticket_close_modal').setTitle('Fermer le ticket');

  const reasonInput = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('Raison de la fermeture (optionnel)')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

/**
 * Ferme le ticket : genere un transcript HTML, l'archive dans un fil
 * dedie du salon d'archives, log l'evenement puis supprime le salon.
 */
async function closeTicket(interaction, reason) {
  const channel = interaction.channel;
  const guild = interaction.guild;
  const topic = channel.topic || '';
  const [, categoryId, openerId] = topic.split(':');
  const category = findCategoryById(categoryId);

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setDescription(
          `🔒 Ticket ferme par ${interaction.user}.${reason ? `\n**Raison :** ${reason}` : ''}\nCe salon sera supprime dans ${config.deleteDelaySeconds} secondes.`
        )
        .setColor(COLOR_DANGER),
    ],
  });

  // Genere le transcript HTML complet de la conversation
  let attachment = null;
  try {
    attachment = await transcripts.createTranscript(channel, {
      limit: -1,
      returnType: 'attachment',
      filename: `${channel.name}.html`,
      saveImages: true,
      poweredBy: false,
    });
  } catch (err) {
    console.error('Erreur lors de la generation du transcript :', err);
  }

  // Archive dans un fil dedie du salon d'archives
  const archiveChannelId = guildConfig.getGuildArchiveChannelId(guild.id);
  if (archiveChannelId && !archiveChannelId.startsWith('METTRE_ICI')) {
    const archiveChannel = guild.channels.cache.get(archiveChannelId);
    if (archiveChannel) {
      const opener = openerId ? await guild.members.fetch(openerId).catch(() => null) : null;

      const archiveEmbed = new EmbedBuilder()
        .setTitle(`Archive : ${channel.name}`)
        .setColor(COLOR_MAIN)
        .addFields(
          { name: 'Categorie', value: category ? category.label : 'Inconnue', inline: true },
          { name: 'Ouvert par', value: opener ? `${opener}` : `<@${openerId}>`, inline: true },
          { name: 'Ferme par', value: `${interaction.user}`, inline: true },
          { name: 'Raison', value: reason || 'Non precisee', inline: false }
        )
        .setTimestamp();

      try {
        const thread = await archiveChannel.threads.create({
          name: `${channel.name}`.slice(0, 100),
          autoArchiveDuration: 10080, // 7 jours
          reason: `Archive du ticket ${channel.name}`,
        });

        await thread.send({
          embeds: [archiveEmbed],
          files: attachment ? [attachment] : [],
        });
      } catch (err) {
        console.error("Erreur lors de la creation du fil d'archive :", err);
      }
    }
  }

  await pushLog(guild, {
    title: '🔴 Ticket ferme',
    description: `Le ticket **${channel.name}** a ete ferme par ${interaction.user}.`,
    color: COLOR_DANGER,
    fields: reason ? [{ name: 'Raison', value: reason }] : [],
  });

  setTimeout(() => {
    channel.delete().catch(() => null);
  }, config.deleteDelaySeconds * 1000);
}

module.exports = {
  createTicket,
  claimTicket,
  promptCloseReason,
  closeTicket,
  findCategoryById,
};
