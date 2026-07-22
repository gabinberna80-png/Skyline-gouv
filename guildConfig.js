const fs = require('fs');
const path = require('path');
const config = require('./config');

const guildConfigPath = path.join(__dirname, 'guild-config.json');

function loadAllGuildConfigs() {
  try {
    if (!fs.existsSync(guildConfigPath)) {
      fs.writeFileSync(guildConfigPath, JSON.stringify({}, null, 2), 'utf8');
    }
    return JSON.parse(fs.readFileSync(guildConfigPath, 'utf8')) || {};
  } catch (error) {
    console.error('Erreur lecture guild-config.json', error);
    return {};
  }
}

function saveAllGuildConfigs(allConfigs) {
  try {
    fs.writeFileSync(guildConfigPath, JSON.stringify(allConfigs, null, 2), 'utf8');
  } catch (error) {
    console.error('Erreur écriture guild-config.json', error);
  }
}

function getGuildConfig(guildId) {
  const allConfigs = loadAllGuildConfigs();
  return allConfigs[guildId] || {};
}

function setGuildConfig(guildId, updates) {
  const allConfigs = loadAllGuildConfigs();
  allConfigs[guildId] = {
    ...(allConfigs[guildId] || {}),
    ...updates,
  };
  saveAllGuildConfigs(allConfigs);
  return allConfigs[guildId];
}

function getGuildAdminRoleIds(guildId) {
  const guildConfig = getGuildConfig(guildId);
  if (Array.isArray(guildConfig.adminRoleIds) && guildConfig.adminRoleIds.length) {
    return guildConfig.adminRoleIds;
  }
  return Array.isArray(config.adminRoleIds) ? config.adminRoleIds : [];
}

function getGuildRdvChannelId(guildId) {
  const guildConfig = getGuildConfig(guildId);
  return guildConfig.rdvChannelId || config.rdvChannelId;
}

function getGuildLogChannelId(guildId) {
  const guildConfig = getGuildConfig(guildId);
  return guildConfig.logChannelId || config.logChannelId;
}

function getGuildArchiveChannelId(guildId) {
  const guildConfig = getGuildConfig(guildId);
  return guildConfig.archiveChannelId || config.archiveChannelId;
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  getGuildAdminRoleIds,
  getGuildRdvChannelId,
  getGuildLogChannelId,
  getGuildArchiveChannelId,
};
