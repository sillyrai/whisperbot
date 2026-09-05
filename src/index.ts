import { Client, Events } from "discord.js";
import Logging from "./Modules/Logging";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import chalk from "chalk";

dotenv.config();

let client = new Client({
    intents: ["GuildVoiceStates", "Guilds", "GuildMessages"],
})

Logging.info("Attempting to start app.")
Logging.debug("Verbose logging is enabled.");

let CommandCache = new Map<string, any>();

async function loadCommands(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            await loadCommands(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            try {
                const commandModule = await import(pathToFileURL(filePath).href);
                const command = commandModule.default || commandModule;
                if (command && 'data' in command && 'execute' in command) {
                    CommandCache.set(command.data.name, command);
                    Logging.info(`Loaded command: ${chalk.yellow(command.data.name)}`);
                } else {
                    Logging.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            } catch (error) {
                Logging.error(`Error loading command at ${filePath}: ${error}`);
            }
        }
    }
}

client.once(Events.ClientReady, async () => {
    Logging.info(`Logged in as ${client.user?.tag}`);

    await loadCommands(path.join(__dirname, 'Commands'));
});

// Handle Slash Commands
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = CommandCache.get(interaction.commandName);
    if (!command) {
        Logging.error(`No command found for ${interaction.commandName}`);
        await interaction.reply({ content: "An error occurred while executing this command. The specified command does not exist.", ephemeral: true });
        return;
    }
    try {
        await command.execute(interaction);
    } catch (error) {
        Logging.error(`Error executing command ${interaction.commandName}: ${error}`);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
        } else {
            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        }
    }
})

// Handle Context Menus
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isContextMenuCommand()) return;
    const command = CommandCache.get(interaction.commandName);
    if (!command) {
        Logging.error(`No command found for ${interaction.commandName}`);
        await interaction.reply({ content: "An error occurred while executing this command. The specified command does not exist.", ephemeral: true });
        return;
    }
    try {
        await command.execute(interaction);
    } catch (error) {
        Logging.error(`Error executing command ${interaction.commandName}: ${error}`);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "There was an error while executing this command!", ephemeral: true });
        } else {
            await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
        }
    }
})

client.login(process.env.DISCORD_TOKEN).catch((error) => {
    Logging.fatal(`Failed to log in: ${error}`);
    process.exit(1);
});
