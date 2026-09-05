/*
Helper module to sanitize Whisper outputs before posting to Discord.
For example, removing unwanted characters or formatting.
*/

export default {
    SanitizeText: (text: string) => {
        // Sometimes it outputs [BLANK_AUDIO] for silent segments or random background noises
        if(text.includes("[BLANK_AUDIO]") || text.includes("[AUDIO OUT]"))
            return null;

        // Sometimes it decides to turn stuff into lists, fix that!!!!!!!!!!!
        text = text.replace(/^\s*[-*+]\s+/gm, ""); // Remove list markers at start of lines

        // Trim leading/trailing whitespace
        text = text.trim();

        // Make everything a single line, since it REALLY loves to paragraph stuff each 5-7 words (replace \n with space)
        text = text.replace(/\n+/g, " ");

        // Replace random double spaces with single spaces
        text = text.replace(/\s{2,}/g, " ");

        // Replace all () with []
        text = text.replace(/\(/g, "[").replace(/\)/g, "]");
        
        // replace all *{word}* with [{word}]
        text = text.replace(/\*([^\*]+)\*/g, "[$1]");

        // Put all [] between **[]** to make them bold
        text = text.replace(/\[([^\]]+)\]/g, "**[$1]**");

        // replace laughing with **[laughs]**
        text = text.replace(/laughing/gi, "**[laughs]**");



        return text;
    },

    // Compare similarity between two messages.
    // Whisper sometimes outputs the same message twice, with minor differences. (i.e "Hello world" vs "Hello, world!")
    // Using Jaccard similarity based on word sets for simplicity.
    CompareMessages: (msg1: string, msg2: string) => {
        const wordsA = new Set(msg1.toLowerCase().split(/\s+/));
        const wordsB = new Set(msg2.toLowerCase().split(/\s+/));

        const intersection = new Set(
            [...wordsA].filter(word => wordsB.has(word))
        );
        const union = new Set([...wordsA, ...wordsB]);
        if (union.size === 0) return 0;
        
        return intersection.size / union.size;
    }
}