const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const REMINDERS_FILE = path.join(__dirname, '..', 'reminders.json');

function loadReminders() {
  try {
    if (fs.existsSync(REMINDERS_FILE)) {
      return JSON.parse(fs.readFileSync(REMINDERS_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('RAPPEL LOAD ERROR:', e);
  }
  return [];
}

function saveReminders(reminders) {
  try {
    fs.writeFileSync(REMINDERS_FILE, JSON.stringify(reminders, null, 2));
  } catch (e) {
    console.error('RAPPEL SAVE ERROR:', e);
  }
}

function parseDuration(str) {
  const regex = /(\d+)\s*(j|h|m|s)/gi;
  let match;
  let totalMs = 0;
  const units = { j: 86400000, h: 3600000, m: 60000, s: 1000 };
  let found = false;
  while ((match = regex.exec(str.toLowerCase())) !== null) {
    found = true;
    totalMs += parseInt(match[1], 10) * units[match[2]];
  }
  if (!found) throw new Error('Format invalide. Exemples valides : 2h, 30m, 1j2h, 45s');
  return totalMs;
}

let clientRef = null;

async function sendReminder(reminder) {
  try {
    const channel = await clientRef.channels.fetch(reminder.channelId).catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle('⏰ Rappel')
      .setDescription(reminder.message)
      .setColor(0xe67e22);

    if (channel) {
      await channel.send({ content: `<@${reminder.userId}>`, embeds: [embed] });
    } else {
      const user = await clientRef.users.fetch(reminder.userId);
      await user.send({ embeds: [embed] });
    }
  } catch (e) {
    console.error('RAPPEL SEND ERROR:', e);
  } finally {
    const reminders = loadReminders().filter((r) => r.id !== reminder.id);
    saveReminders(reminders);
  }
}

function scheduleReminder(reminder) {
  const delay = new Date(reminder.triggerTime).getTime() - Date.now();
  if (delay <= 0) {
    sendReminder(reminder);
  } else {
    setTimeout(() => sendReminder(reminder), delay);
  }
}

function restoreReminders(client) {
  clientRef = client;
  const reminders = loadReminders();
  reminders.forEach(scheduleReminder);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rappel')
    .setDescription('Programme un rappel')
    .addStringOption((option) =>
      option.setName('temps').setDescription('Durée avant le rappel (ex: 2h, 30m, 1j)').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('message').setDescription('Le message du rappel').setRequired(true)
    ),
  restoreReminders,
  async execute(interaction) {
    if (!clientRef) clientRef = interaction.client;

    const tempsStr = interaction.options.getString('temps');
    const message = interaction.options.getString('message');

    let delayMs;
    try {
      delayMs = parseDuration(tempsStr);
    } catch (e) {
      return interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    }

    const triggerTime = new Date(Date.now() + delayMs);
    const reminder = {
      id: `${interaction.user.id}-${Date.now()}`,
      userId: interaction.user.id,
      channelId: interaction.channelId,
      message,
      triggerTime: triggerTime.toISOString(),
    };

    const reminders = loadReminders();
    reminders.push(reminder);
    saveReminders(reminders);
    scheduleReminder(reminder);

    const unixTs = Math.floor(triggerTime.getTime() / 1000);
    return interaction.reply({
      content: `✅ Rappel programmé pour <t:${unixTs}:R> : « ${message} »`,
    });
  },
};
