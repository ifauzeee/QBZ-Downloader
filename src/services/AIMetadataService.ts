import axios from 'axios';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { Metadata } from './metadata.js';

export class AIMetadataService {
    private sanitize(text: string | number | undefined): string {
        if (text === undefined) return 'Unknown';
        const str = String(text);
        // Basic sanitization: remove potential prompt injection characters
        // and limit length to prevent massive payloads
        return str
            .replace(/[\\`$]/g, '') // Remove backslashes, backticks, and dollar signs
            .substring(0, 200) // Limit to 200 characters
            .trim();
    }

    async repairMetadata(currentMetadata: Partial<Metadata>): Promise<Partial<Metadata> | null> {
        const { enabled, provider, apiKey, model } = CONFIG.ai;

        if (!enabled || provider === 'none' || !apiKey) {
            return null;
        }

        logger.info(`AI: Attempting to repair metadata for "${currentMetadata.title}" using ${provider}`, 'AI');

        try {
            if (provider === 'gemini') {
                return await this.repairWithGemini(currentMetadata, apiKey, model);
            } else if (provider === 'openai') {
                return await this.repairWithOpenAI(currentMetadata, apiKey, model);
            }
            return null;
        } catch (error: unknown) {
            let message = error instanceof Error ? error.message : 'Unknown error';
            if (apiKey) {
                message = message.split(apiKey).join('***REDACTED***');
            }
            logger.error(`AI Metadata Repair Failed: ${message}`, 'AI');
            return null;
        }
    }

    private async repairWithGemini(metadata: Partial<Metadata>, apiKey: string, model: string): Promise<Partial<Metadata>> {
        const sTitle = this.sanitize(metadata.title);
        const sArtist = this.sanitize(metadata.artist);
        const sAlbum = this.sanitize(metadata.album);
        const sYear = this.sanitize(metadata.year);
        const sGenre = this.sanitize(metadata.genre);

        const prompt = `
            Act as a professional music librarian. I have a music track with potentially incomplete or incorrect metadata.
            Fix and complete the following metadata as accurately as possible.
            Ensure names are spelled correctly, dates are accurate, and genre is specific.
            
            Current Data:
            Title: ${sTitle}
            Artist: ${sArtist}
            Album: ${sAlbum}
            Year: ${sYear}
            Genre: ${sGenre}
            
            Return ONLY a JSON object with these keys: title, artist, album, year, genre, albumArtist, composer.
            Do not include any explanation or other text.
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }]
        }, {
            headers: {
                'x-goog-api-key': apiKey
            }
        });

        const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Empty response from AI');

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI did not return valid JSON');

        return JSON.parse(jsonMatch[0]);
    }

    private async repairWithOpenAI(metadata: Partial<Metadata>, apiKey: string, model: string): Promise<Partial<Metadata>> {
        const sTitle = this.sanitize(metadata.title);
        const sArtist = this.sanitize(metadata.artist);
        const sAlbum = this.sanitize(metadata.album);

        const url = 'https://api.openai.com/v1/chat/completions';
        
        const response = await axios.post(url, {
            model: model,
            messages: [
                {
                    role: 'system',
                    content: 'You are a music metadata expert. Return JSON ONLY.'
                },
                {
                    role: 'user',
                    content: `Fix this metadata: Title: ${sTitle}, Artist: ${sArtist}, Album: ${sAlbum}. Return JSON: {title, artist, album, year, genre, albumArtist, composer}`
                }
            ],
            response_format: { type: 'json_object' }
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const content = response.data?.choices?.[0]?.message?.content;
        return JSON.parse(content);
    }
}

export const aiMetadataService = new AIMetadataService();

