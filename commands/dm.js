const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    adminOnly: true, // Seuls les admins (ou rôles admin configurés) peuvent l'utiliser

    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Envoie un message privé officiel à un membre')
        .addUserOption((option) =>
            option
                .setName('membre')
                .setDescription('Le membre à qui envoyer le message')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('message')
                .setDescription('Le contenu du message')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('signature')
                .setDescription("Texte affiché en bas du message (ex: nom du service)")
                .setRequired(false),
        ),

    async execute(interaction) {
        const membre = interaction.options.getUser('membre');
        const message = interaction.options.getString('message');
        const signature = interaction.options.getString('signature') || interaction.guild.name;

        const embed = new EmbedBuilder()
            .setTitle('📩 Message officiel')
            .setDescription(message)
            .setColor(0x2b2d31)
            .setFooter({ text: signature })
            .setTimestamp();

        try {
            await membre.send({ embeds: [embed] });
            await interaction.reply({
                content: `✅ Message envoyé à ${membre.tag}.`,
                ephemeral: true,
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({
                content: `❌ Impossible d'envoyer le message à ${membre.tag} (DMs probablement fermés).`,
                ephemeral: true,
            });
        }
    },
};
