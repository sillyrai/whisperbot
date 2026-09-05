import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction, EmbedBuilder, InteractionContextType } from "discord.js";
import { GetDirectURL } from "../../Modules/Direct";
import axios from "axios";
import VoiceToText from "../../Modules/VoiceToText";
import Logging from "../../Modules/Logging";

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName("Transcribe Message")
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild, InteractionContextType.PrivateChannel),

    async execute(interaction: ContextMenuCommandInteraction) {
        if(!interaction.isMessageContextMenuCommand()) return;

        // If this is in DMs, we defer with no ephemeral since DMs dont support it
        // If we are in a guild, we defer with ephemeral to avoid spamming
        let msg = await interaction.reply(`<a:Loading:1450973699703439430> Processing message... This may take a moment!`)

        const message = interaction.targetMessage;

        // If has attachments, we get first attachment
        // If has url that has a file extension, we use that
        // If its a youtube/instagram link, we use the Direct module to get direct link (also an mp4 link)
        let attachmentUrl : string | null = null;
        if(message.attachments.size > 0){
            attachmentUrl = message.attachments.first()!.url;
        }
        else{
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urls = message.content.match(urlRegex);
            if(urls && urls.length > 0){
                attachmentUrl = urls[0];
            }
        }

        // Check for insta/yt
        if(attachmentUrl){
            if(attachmentUrl.includes("youtube.com") || attachmentUrl.includes("youtu.be") || attachmentUrl.includes("instagram.com")){
                const directLink = await GetDirectURL(attachmentUrl);
                if(directLink){
                    attachmentUrl = directLink.url || "";
                }
            }
        }

        if(!attachmentUrl){
            await interaction.followUp("No valid attachment or URL found in the message.");
            return;
        }

        // Get Content Type from URL
        let contentType = "";
        try{
            const headResp = await axios.head(attachmentUrl);
            contentType = headResp.headers['content-type'] || "";
        }
        catch(error){
            console.error("Error fetching content type:", error);
        }


        // Check if content type is audio or video
        if(!contentType.startsWith("audio/") && !contentType.startsWith("video/") && contentType !== ""){ 
            await interaction.followUp(`Contet Type: ${contentType} is not supported. Please provide an audio or video file.`);
            return;
        }

        // Download media locally so we can use VoiceToText.TranscribeLocalFile
        let stopwatch = Date.now();
        axios.get(attachmentUrl, { responseType: 'arraybuffer' })
            .then(async (response) => {
                const buffer = Buffer.from(response.data, 'binary');
                const tempFilePath = `./tmp/message_media_${interaction.id}_${Date.now()}`;
                const fs = require('fs');
                fs.writeFileSync(tempFilePath, buffer);

                try{
                    const transcriptionResult = await VoiceToText.TranscribeLocalFile(tempFilePath);
                    let transcriptionText = transcriptionResult.text || "No transcription available.";

                    let _ = new EmbedBuilder()
                        .setTitle("Transcription")
                        .setTimestamp(new Date())
                        .setFooter({ text: `Processing took ${((Date.now() - stopwatch)/1000).toFixed(2)} seconds` })
                        .setColor("#EF7BB0")
                        .setDescription(transcriptionText);

                    await msg.edit({ embeds: [_], content: "" } );
                }
                catch(error){
                    Logging.error("Error during transcription:"+ error);
                    await msg.edit("An error occurred during transcription.");
                }
                finally{
                    // Clean up temp file
                    if(fs.existsSync(tempFilePath)){
                        fs.unlinkSync(tempFilePath);
                    }
                }
            })
            .catch(async (error) => {
                Logging.error("Error downloading media file:"+ error);
                await msg.edit("An error occurred while downloading the media file.");
            }
        );
    }
}