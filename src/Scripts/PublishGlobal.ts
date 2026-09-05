import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

dotenv.config({quiet:true});

const commands: any[] = [];
const commandsPath = path.join(__dirname, '../Commands');

async function readCommands(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            await readCommands(filePath);
        } else if (file.endsWith('.ts') || file.endsWith('.js')) {
            try {
                // Dynamic import to handle both ESM and CommonJS
                const commandModule = await import(pathToFileURL(filePath).href);
                const command = commandModule.default || commandModule;
                
                if (command && 'data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                } else {
                    console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            } catch (error) {
                console.error(`Error loading command at ${filePath}:`, error);
            }
        }
    }
}

(async () => {
    try {
        await readCommands(commandsPath);
        
        if (!process.env.DISCORD_TOKEN) {
            throw new Error("DISCORD_TOKEN is missing in .env file");
        }

        const rest = new REST().setToken(process.env.DISCORD_TOKEN);

        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // Fetch client ID dynamically
        const currentUser = await rest.get(Routes.user('@me')) as { id: string };
        const clientId = currentUser.id;

        // The put method is used to fully refresh all commands globally
        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands },
        ) as any[];

        console.log(`Successfully reloaded ${data.length} application (/) commands globally.`);
    } catch (error) {
        console.error(error);
    }
})();
