import { describe, expect, it } from 'vitest';
import { getMetadataIssueTags } from './worker.js';

describe('library scanner worker metadata issue tags', () => {
    it('does not treat cover art or lyrics as core metadata issues', () => {
        expect(getMetadataIssueTags(['Cover Art', 'Lyrics'])).toEqual([]);
    });

    it('keeps core missing tags as metadata issues', () => {
        expect(getMetadataIssueTags(['Cover Art', 'Genre', 'Lyrics', 'Year'])).toEqual([
            'Genre',
            'Year'
        ]);
    });
});
