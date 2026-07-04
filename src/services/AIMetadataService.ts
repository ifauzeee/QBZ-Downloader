import axios from 'axios';
import { z } from 'zod';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { Metadata } from './metadata.js';

const MAX_METADATA_FIELD_LENGTH = 300;
const MIN_REASONABLE_YEAR = 1000;
const MAX_REASONABLE_YEAR = new Date().getFullYear() + 1;

function hasControlCharacter(value: string): boolean {
    return Array.from(value).some((char) => {
        const code = char.charCodeAt(0);
        return code <= 0x1f || code === 0x7f;
    });
}

const aiMetadataTextField = z
    .string()
    .trim()
    .min(1)
    .max(MAX_METADATA_FIELD_LENGTH)
    .refine((value) => !hasControlCharacter(value), {
        message: 'must not contain control characters'
    });

const aiMetadataYearField = z
    .union([z.number().int(), z.string().trim().regex(/^\d{4}$/)])
    .refine(
        (value) => {
            const year = typeof value === 'number' ? value : Number(value);
            return year >= MIN_REASONABLE_YEAR && year <= MAX_REASONABLE_YEAR;
        },
        {
            message: `must be between ${MIN_REASONABLE_YEAR} and ${MAX_REASONABLE_YEAR}`
        }
    );

const aiMetadataSchema = z
    .object({
        title: aiMetadataTextField.optional(),
        artist: aiMetadataTextField.optional(),
        album: aiMetadataTextField.optional(),
        year: aiMetadataYearField.optional(),
        genre: aiMetadataTextField.optional(),
        albumArtist: aiMetadataTextField.optional(),
        composer: aiMetadataTextField.optional()
    })
    .strict()
    .refine((value) => Object.values(value).some((field) => field !== undefined), {
        message: 'must include at least one metadata field'
    });

const geminiResponseSchema = z.object({
    candidates: z
        .array(
            z.object({
                content: z.object({
                    parts: z.array(z.object({ text: z.string() }).passthrough()).min(1)
                }).passthrough()
            }).passthrough()
        )
        .min(1)
});

const openAIResponseSchema = z.object({
    choices: z
        .array(
            z.object({
                message: z.object({
                    content: z.string()
                }).passthrough()
            }).passthrough()
        )
        .min(1)
});

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

    private extractJsonObject(text: string): unknown {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI did not return valid JSON');

        try {
            return JSON.parse(jsonMatch[0]);
        } catch {
            throw new Error('AI returned malformed JSON');
        }
    }

    private validateMetadataResponse(raw: unknown): Partial<Metadata> {
        const parsed = aiMetadataSchema.safeParse(raw);
        if (!parsed.success) {
            const details = parsed.error.issues
                .map((issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`)
                .join('; ');
            throw new Error(`AI metadata schema validation failed: ${details}`);
        }

        return Object.fromEntries(
            Object.entries(parsed.data).filter(([, value]) => value !== undefined)
        ) as Partial<Metadata>;
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

        const parsedResponse = geminiResponseSchema.safeParse(response.data);
        if (!parsedResponse.success) throw new Error('Invalid Gemini response schema');

        const text = parsedResponse.data.candidates[0]!.content.parts[0]!.text;
        if (!text.trim()) throw new Error('Empty response from AI');

        return this.validateMetadataResponse(this.extractJsonObject(text));
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

        const parsedResponse = openAIResponseSchema.safeParse(response.data);
        if (!parsedResponse.success) throw new Error('Invalid OpenAI response schema');

        const content = parsedResponse.data.choices[0]!.message.content;
        if (!content.trim()) throw new Error('Empty response from AI');

        return this.validateMetadataResponse(this.extractJsonObject(content));
    }
}

export const aiMetadataService = new AIMetadataService();
