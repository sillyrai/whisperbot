import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";
import Logging from "../../Modules/Logging";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("leave")
        .setDescription("Makes the bot leave the voice channel."),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        if (!interaction.guildId) {
             await interaction.followUp({ content: "This command can only be used in a server.", ephemeral: true });
             return;
        }

        const connection = getVoiceConnection(interaction.guildId);

        if (!connection) {
            await interaction.followUp({ content: "I'm not currently in a voice channel!", ephemeral: true });
            return;
        }

        connection.destroy();
        Logging.info(`User ${interaction.user.id} used /leave in guild ${interaction.guildId}.`);

        await interaction.followUp({ content: "Left the voice channel." });
    },
}
