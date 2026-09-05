import axios from 'axios';

export interface CobaltResponse {
    status: 'tunnel' | 'redirect' | 'picker' | 'error' | 'local-processing';
    url?: string;
    picker?: { url: string }[];
    error?: { code: string };
}

export async function GetDirectURL(url: string, downloadMode: 'auto' | 'audio' | 'mute' = 'audio'): Promise<CobaltResponse> {
    try {
        const response = await axios.post('https://co.rai.lol/', {
            url: url,
            downloadMode: downloadMode
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Cobalt API request failed:', error);
        throw error;
    }
}

export function getBestUrlFromCobalt(data: CobaltResponse): string | null {
    if (data.status === 'tunnel' || data.status === 'redirect') {
        return data.url || null;
    } else if (data.status === 'picker' && data.picker && data.picker.length > 0) {
        return data.picker[0].url;
    }
    return null;
}
