import { ChatInputCommandInteraction, GuildMember, GuildMFALevel, SlashCommandBuilder, Subscription, TextChannel, VoiceConnectionStates, VoiceState } from "discord.js";
import { EndBehaviorType, getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import Logging from "../../Modules/Logging";
import prism from "prism-media";
import { Writer } from "wav";
import fs from "fs";
import VTT from "../../Modules/VoiceToText";
import Sanitizer from "../../Modules/Sanitizer";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("join")
        .setDescription("Makes the bot join your voice channel and begins transcribing messages."),

    async execute(interaction: ChatInputCommandInteraction) {

        await interaction.deferReply();
        let member = await interaction.guild?.members.fetch(interaction.user.id);

        // Check if in vc
        let voiceChannel = member?.voice.channel;
        if (!voiceChannel) {
            await interaction.followUp({ content: "You need to be in a voice channel for me to join!", ephemeral: true });
            return;
        }
        Logging.debug(`User ${interaction.user.id} is in voice channel ${voiceChannel.id}, attempting to join.`);

        // Check if bot is already in vc
        let botMember = await interaction.guild?.members.fetch(interaction.client.user!.id);
        let botVoiceChannel = botMember?.voice.channel;
        if (botVoiceChannel) {
            // Attempt to leave and rejoin, even if in same channel
            const existingConnection = getVoiceConnection(interaction.guildId!);
            if (existingConnection) {
                existingConnection.destroy();
                Logging.info(`Bot was already in voice channel ${botVoiceChannel.id}, leaving to rejoin ${voiceChannel.id}.`);
                await new Promise(resolve => setTimeout(resolve, 1000)); // wait a second
            }
        }

        // Fetch webhook
        let webhook = null;
        let textChannel = interaction.channel as TextChannel;  
        let webhooks = await textChannel.fetchWebhooks();
        webhook = webhooks.find(wh => wh.owner?.id === interaction.client.user?.id);
        if (!webhook) {
            // First check if we have permission to manage webhooks
            if (!textChannel.permissionsFor(interaction.client.user!)?.has("ManageWebhooks")) {
                await interaction.followUp({ content: "I don't have permission to create webhooks in this channel! Please grant me the 'Manage Webhooks' permission and try again.", ephemeral: true });
                return;
            }
            webhook = await textChannel.createWebhook({
                name: "Transcription Webhook",
                reason: `Created for transcriptions in ${textChannel.name}`,
            });
        }
        Logging.debug(`Using webhook ${webhook.id} for transcriptions in channel ${textChannel.id}`);

        // attempt to join vc

        let voiceConnection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false // the whole point is that we can hear people
        })
        const voiceReceiver = voiceConnection.receiver;

        const voiceStateListener = (oldState: VoiceState, newState: VoiceState) => {
            // Stop listening if bot leaves vc
            if (oldState.channelId === voiceChannel?.id && newState.channelId !== voiceChannel?.id && newState.id === interaction.client.user?.id) {
                Logging.info(`Bot has left voice channel ${voiceChannel.id}, destroying connection and removing listener.`);
                voiceConnection.destroy();
                interaction.client.off("voiceStateUpdate", voiceStateListener);
            }

            // Handle new user joining call
            if (oldState.channelId !== voiceChannel?.id && newState.channelId === voiceChannel?.id) {
                Logging.info(`User ${newState.id} has joined voice channel ${voiceChannel.id}, starting to listen for speech.`);
                if(newState.id !== interaction.client.user?.id){
                    webhook?.send({ content: `User <@${newState.id}> has joined <#${voiceChannel.id}>.` });
                }
            }
            // Handle user leaving call
            if (oldState.channelId === voiceChannel?.id && newState.channelId !== voiceChannel?.id) {
                Logging.info(`User ${oldState.id} has left voice channel ${voiceChannel.id}.`);
                if(oldState.id !== interaction.client.user?.id){
                    webhook?.send({ content: `User <@${oldState.id}> has left <#${voiceChannel.id}>.` });
                }
                // If no one else is in the vc, leave and remove listener
                if (voiceChannel.members.size === 1 && voiceChannel.members.has(interaction.client.user!.id)) {
                    Logging.info(`No more users in voice channel ${voiceChannel.id}, leaving channel.`);
                    voiceConnection.destroy();

                    webhook?.send({ content: `No more users in <#${voiceChannel.id}>, leaving voice channel.` });
                }
            }
        }

        // Incase of disconnects or other state changes that end up in a destroyed state, we disable the listener
        voiceConnection.on("stateChange", (oldState, newState) => {
            if(newState.status === VoiceConnectionStatus.Destroyed){
                Logging.info(`Voice connection to channel ${voiceChannel?.id} destroyed, removing listener.`);
                interaction.client.off("voiceStateUpdate", voiceStateListener);
                Logging.debug(`Voice connection to channel ${voiceChannel?.id} destroyed from state ${oldState.status} to ${newState.status}.`);
            }
        })

        let LastMessages : Map<string, string> = new Map(); // Store incase of random duplicates
        let listeningUsers = new Set<string>();
        interaction.followUp({ content: `Started listening to everyone in <#${voiceChannel?.id}>.`});
        // Listen to users and save their audio streams
        voiceReceiver.speaking.on("start", (userId) => {
            if (listeningUsers.has(userId)) return;
            listeningUsers.add(userId);
            let path = `./tmp/voice_${interaction.guild?.id}_${userId}_${Date.now()}.wav`;

            const opusStream = voiceReceiver.subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000, // people REALLY love to pause for moments and continue talking the same sentence
                }
            });

            // Handle audio stream errors
            opusStream.on("error", (error) => {
                listeningUsers.delete(userId);
                Logging.error(`Error in audio stream for user ${userId} in channel ${voiceChannel?.id}: ${error}`);
            })

            const decoder = new prism.opus.Decoder({ // Decoder to convert opus to pcm
                frameSize: 960,
                channels: 2,
                rate: 48000,
            })

            // Handle decoder errors
            decoder.on("error", (error) => {
                listeningUsers.delete(userId);
                Logging.error(`Error in PCM decoder for user ${userId} in channel ${voiceChannel?.id}: ${error}`);
            })

            
            const wavWriter = new Writer({ // WAV writer to convert pcm to wav
                sampleRate: 48000,
                channels: 2,
                bitDepth: 16,
            });

            const fileStream = fs.createWriteStream(path);
            opusStream.pipe(decoder).pipe(wavWriter).pipe(fileStream);
            
            fileStream.on("finish", async () => {
                listeningUsers.delete(userId);
                try{
                    // If audio is less than 1 second, skip
                    const stats = fs.statSync(path);
                    const fileSizeInBytes = stats.size;
                    const bytesPerSecond = 48000 * 2 * 2; // sampleRate * channels * bytesPerSample
                    const durationInSeconds = fileSizeInBytes / bytesPerSecond;
                    if(durationInSeconds < 1){
                        Logging.info(`Audio clip for user ${userId} in channel ${voiceChannel?.id} is too short (${durationInSeconds.toFixed(2)}s), skipping transcription.`);
                        return;
                    }
                    Logging.debug(`Audio clip for user ${userId} in channel ${voiceChannel?.id} finished recording (${durationInSeconds.toFixed(2)}s), starting transcription.`);

                    // Transcribe the audio file
                    let data = await VTT.TranscribeLocalFile(path);
                    let text = data.text;
                    // Sanitize it (since whisper can be funny)
                    text = Sanitizer.SanitizeText(text);

                    if(!text){
                        return;
                    }

                    // Check against last message to avoid duplicates
                    let lastMsg = LastMessages.get(userId) || "";
                    let similarity = Sanitizer.CompareMessages(text, lastMsg);
                    Logging.info(`Transcription for user ${userId} in channel ${voiceChannel?.id}: "${text}" (similarity to last message: ${similarity})`);
                    LastMessages.set(userId, text);
                    if(similarity > 0.35){ // .55 is usually good cuz works well on large paragraphs
                        Logging.info(`Transcription for user ${userId} in channel ${voiceChannel?.id} is too similar to last message (similarity: ${similarity}), skipping.`);
                        return;
                    }

                    // Suffix the language
                    if(data.detected_language_probability > 0.75 && data.detected_language !== "english"){
                        text += `\n-# :map: Transcribed from ${data.detected_language} (confidence: ${(data.detected_language_probability).toFixed(2)}%)`;
                    }

                    // if message is "Thank you." also add a suffix for duration of audio clip source
                    let lowConfidenceWords = ["thank you.", "yeah.", "bye."]
                    const normalized = text.trim().toLowerCase();
                    if (lowConfidenceWords.includes(normalized)) {
                        const conf = data.segments?.[0]?.words?.[0]?.probability ?? 0;
                        if (conf < 0.65) return; // ignore low-confidence matches
                        text += `\n-# :warning: Debug Confidence: ${(conf*100).toFixed(2)}%`;
                    }

                    // Add confidence score to each message
                    // in data, there is a segments array, each segment has a words array, and each word has a probability field
                    let avgConf = 0;
                    let wordCount = 0;
                    data.segments.forEach((segment: any) => {
                        segment.words.forEach((word: any) => {
                            avgConf += word.probability;
                            wordCount++;
                        })
                    });
                    avgConf = avgConf / wordCount;
                    // text += `\n-# :mag_right: Average confidence: ${(avgConf * 100).toFixed(2)}% over ${wordCount} words.`;


                    let speaker = await interaction.guild?.members.cache.get(userId) as GuildMember;
                    webhook?.send({
                        content: text,
                        username: speaker?.nickname || speaker?.user.displayName || speaker?.user.username || "Unknown User",
                        avatarURL:  speaker.displayAvatarURL() || speaker.user.avatarURL() || undefined,
                        allowedMentions: { parse: [] }, // disable mentions
                    });


                }
                catch(error){
                    Logging.error(`Error processing audio file for user ${userId} in channel ${voiceChannel?.id}: ${error}`);
                }
                finally{
                    // Clean up temp file
                    if(fs.existsSync(path)){
                        fs.unlinkSync(path);
                    }
                }
            })
        })

        interaction.client.on("voiceStateUpdate", voiceStateListener);
    },
}