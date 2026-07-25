const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.join(__dirname, 'service-data.json');

function loadData() {
  if (!fs.existsSync(DATA_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  } catch (err) {
    console.error('Erreur lecture service-data.json:', err);
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function getUserEntry(data, guildId, userId) {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      totalSeconds: 0,
      currentSessionStart: null,
      history: [], // { start, end, durationSeconds }
    };
  }
  return data[guildId][userId];
}

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}h ${m}m ${s}s`;
}

async function handleStart(interaction) {
  const data = loadData();
  const entry = getUserEntry(data, interaction.guildId, interaction.user.id);

  if (entry.currentSessionStart) {
    return interaction.reply({
      content: '⚠️ Vous êtes déjà en service.',
      ephemeral: true,
    });
  }

  entry.currentSessionStart = Date.now();
  saveData(data);

  return interaction.reply({
    content: `🟢 Prise de service enregistrée à <t:${Math.floor(Date.now() / 1000)}:T>.`,
    ephemeral: true,
  });
}

async function handleEnd(interaction) {
  const data = loadData();
  const entry = getUserEntry(data, interaction.guildId, interaction.user.id);

  if (!entry.currentSessionStart) {
    return interaction.reply({
      content: "⚠️ Vous n'êtes pas en service actuellement.",
      ephemeral: true,
    });
  }

  const start = entry.currentSessionStart;
  const end = Date.now();
  const durationSeconds = Math.floor((end - start) / 1000);

  entry.totalSeconds += durationSeconds;
  entry.history.push({ start, end, durationSeconds });
  entry.currentSessionStart = null;
  saveData(data);

  return interaction.reply({
    content:
      `🔴 Fin de service. Durée de la session : **${formatDuration(durationSeconds)}**.\n` +
      `Temps total cumulé : **${formatDuration(entry.totalSeconds)}**.`,
    ephemeral: true,
  });
}

async function handleHours(interaction) {
  const data = loadData();
  const entry = getUserEntry(data, interaction.guildId, interaction.user.id);

  let liveSeconds = entry.totalSeconds;
  if (entry.currentSessionStart) {
    liveSeconds += Math.floor((Date.now() - entry.currentSessionStart) / 1000);
  }

  const embed = new EmbedBuilder()
    .setTitle('📊 Heures de service')
    .setDescription(
      `${interaction.user} a effectué **${formatDuration(liveSeconds)}** de service au total.` +
        (entry.currentSessionStart
          ? '\n🟢 Actuellement en service.'
          : '\n🔴 Actuellement hors service.')
    )
    .setColor(0x2b2d31);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function resetUserHours(interaction, targetUserId) {
  const data = loadData();
  const entry = getUserEntry(data, interaction.guildId, targetUserId);

  entry.totalSeconds = 0;
  entry.history = [];
  // On ne touche pas à currentSessionStart : si le membre est en service
  // au moment du reset, il reste en service (juste son compteur repart à 0).
  saveData(data);

  return interaction.update({
    content: `♻️ Les heures de <@${targetUserId}> ont été réinitialisées.`,
    components: [],
  });
}

module.exports = {
  handleStart,
  handleEnd,
  handleHours,
  resetUserHours,
  loadData,
  saveData,
  formatDuration,
};
