const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('documents')
        .setDescription('Affiche la liste des documents disponibles'),

    async execute(interaction) {
        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('documents_select')
                .setPlaceholder('Choisis un document')
                .addOptions([
                    {
                        label: 'Acte Etat Civil',
                        value: 'acte_etat_civil',
                    },
                    {
                        label: 'Acte Changement identité',
                        value: 'acte_changement_identite',
                    },
                    {
                        label: 'Acte de Mariage',
                        value: 'acte_mariage',
                    },
                ]),
        );

        await interaction.reply({
            content: 'Sélectionne le document que tu veux consulter :',
            components: [row],
            ephemeral: true,
        });
    },
};
