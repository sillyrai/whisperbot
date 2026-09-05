import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pings the bot to check its uptime!"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.reply("Pong!");
    },
}