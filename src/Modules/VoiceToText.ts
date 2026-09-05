import axios from "axios";
import FormData from "form-data";
import fs from "fs";

export default {
    TranscribeLocalFile: async (filePath: string) => {
        const link = process.env.WHISPER_SERVER

        const form = new FormData();
        form.append("file", fs.createReadStream(filePath));
        form.append("response_format", "verbose_json");
        form.append("temperature", "0.0");
        form.append("temperature_inc", "0.3")
        
        const res = await axios.post(link + "/inference", form, {
            headers: form.getHeaders()
        });
        //console.debug(JSON.stringify(res.data, null, 2));
        return res.data;
    }
}