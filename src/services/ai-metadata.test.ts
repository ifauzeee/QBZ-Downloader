import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIMetadataService } from './AIMetadataService.js';
import { settingsService } from './settings.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');

vi.mock('./settings.js', () => ({
    settingsService: {
        get: vi.fn()
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('AIMetadataService', () => {
    let service: AIMetadataService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new AIMetadataService();
    });

    describe('Sanitization', () => {
        it('should sanitize input strings', () => {
            const input = '`Dangerous` $Text \\With Backslashes';
            const result = (service as unknown as { sanitize: (s: string) => string }).sanitize(input);
            expect(result).toBe('Dangerous Text With Backslashes');
        });

        it('should truncate long strings', () => {
            const long = 'a'.repeat(300);
            const result = (service as unknown as { sanitize: (s: string) => string }).sanitize(long);
            expect(result.length).toBe(200);
        });
    });

    describe('Metadata Repair', () => {
        it('should return null if AI is disabled', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'AI_REPAIR_ENABLED') return 'false';
                return '';
            });
            
            const result = await service.repairMetadata({ title: 'Test' });
            expect(result).toBeNull();
        });

        it('should repair metadata using Gemini', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'AI_REPAIR_ENABLED') return 'true';
                if (key === 'AI_PROVIDER') return 'gemini';
                if (key === 'AI_API_KEY') return 'key-123';
                if (key === 'AI_MODEL') return 'gemini-pro';
                return '';
            });

            const mockResponse = {
                data: {
                    candidates: [{
                        content: {
                            parts: [{
                                text: '```json\n{"title": "Fixed Title", "genre": "Pop"}\n```'
                            }]
                        }
                    }]
                }
            };
            vi.mocked(axios.post).mockResolvedValue(mockResponse);

            const result = await service.repairMetadata({ title: 'Test' });
            expect(result).toEqual({ title: 'Fixed Title', genre: 'Pop' });
        });

        it('should repair metadata using OpenAI', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'AI_REPAIR_ENABLED') return 'true';
                if (key === 'AI_PROVIDER') return 'openai';
                if (key === 'AI_API_KEY') return 'key-123';
                if (key === 'AI_MODEL') return 'gpt-4';
                return '';
            });
            
            const mockResponse = {
                data: {
                    choices: [{
                        message: {
                            content: '{"title": "OpenAI Fixed", "year": "2023"}'
                        }
                    }]
                }
            };
            vi.mocked(axios.post).mockResolvedValue(mockResponse);

            const result = await service.repairMetadata({ title: 'Test' });
            expect(result).toEqual({ title: 'OpenAI Fixed', year: '2023' });
        });

        it('should redact API keys in error messages', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'AI_REPAIR_ENABLED') return 'true';
                if (key === 'AI_PROVIDER') return 'gemini';
                if (key === 'AI_API_KEY') return 'SUPER_SECRET_KEY';
                return '';
            });
            
            vi.mocked(axios.post).mockRejectedValue(new Error('Failed for key SUPER_SECRET_KEY'));
            
            await service.repairMetadata({ title: 'Test' });
            
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining('***REDACTED***'),
                'AI'
            );
        });
    });
});
