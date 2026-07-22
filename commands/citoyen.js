const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getCitizens } = require('../googleSheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('citoyen')
    .setDescription('Rechercher un citoyen dans Google Sheets')
    .addStringOption((option) =>
      option.setName('recherche').setDescription('Nom ou prénom à rechercher').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  adminOnly: true,

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const query = interaction.options.getString('recherche').trim().toLowerCase();

    try {
      let citizens;
      try { citizens = await getCitizens(); } catch(e) { console.error('GETCITIZENS ERROR:', e); citizens = []; }
      console.log('CITIZENS:', JSON.stringify(citizens));
      const matches = citizens.filter((citizen) => {
        const fullName = `${citizen.prenom || ''} ${citizen.nom || ''}`.toLowerCase().trim();
        const nom = (citizen.nom || '').toLowerCase().trim();
        const prenom = (citizen.prenom || '').toLowerCase().trim();
        const ville = (citizen.ville || '').toLowerCase().trim();
        return fullName.includes(query) || nom.includes(query) || prenom.includes(query) || ville.includes(query);
      });

      if (!matches.length) {
        return interaction.editReply({ content: `Aucun citoyen trouvé pour la recherche : **${query}**.` });
      }

      const embed = new EmbedBuilder()
        .setTitle('Résultat de la recherche')
        .setColor(0x2ecc71)
        .setDescription(`${matches.length} résultat(s) trouvé(s) pour **${query}**.`);

      matches.slice(0, 10).forEach((citizen, index) => {
        embed.addFields({
          name: `#${index + 1} — ${citizen.prenom} ${citizen.nom}`.trim(),
          value: `Année de naissance : ${citizen.anneeNaissance || 'N/A'}\nNationalité : ${citizen.nationalite || 'N/A'}\nLieu de naissance : ${citizen.lieuNaissance || 'N/A'}\nSexe : ${citizen.sexe || 'N/A'}${citizen.casier ? `\n📁 Casier : [Voir le casier](${citizen.casier})` : '\n📁 Casier : Vierge'}`,
          inline: false,
        });
      });

      if (matches.length > 10) {
        embed.addFields({ name: 'Autres résultats', value: `Il y a ${matches.length} résultats au total.`, inline: false });
      }

      embed.addFields({ name: '📋 Google Sheet', value: '[Voir le sheet complet](https://docs.google.com/spreadsheets/d/1irMqftjyNHpdRZ_1J1OvuuWxFBR75TP-iLEGREwmBZs/edit?gid=0#gid=0)', inline: false });
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('CITOYEN ERROR:', error);
      return interaction.editReply({ content: `Erreur : ${error.message}` });
    }
  },
};
