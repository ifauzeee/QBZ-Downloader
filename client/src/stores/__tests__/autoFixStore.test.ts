import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAutoFixStore, type AutoFixFile } from '../autoFixStore';
import { smartFetch } from '../../utils/api';

vi.mock('../../utils/api', () => ({ smartFetch: vi.fn() }));

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response;
const fail = (status: number, error: string) =>
    ({ ok: false, status, json: async () => ({ error }) }) as unknown as Response;

const file = (filePath: string): AutoFixFile => ({
    filePath,
    title: 'T',
    artist: 'A',
    status: 'pending'
});

const reset = (files: AutoFixFile[]) =>
    useAutoFixStore.setState({ files, running: false, stopRequested: false });

describe('autoFixStore', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        reset([]);
    });

    it('marks a file failed and keeps the reason when the write is rejected', async () => {
        reset([file('/music/a.flac')]);
        vi.mocked(smartFetch)
            .mockResolvedValueOnce(ok({ data: { title: 'Real', artist: 'Band' } }))
            .mockResolvedValueOnce(fail(500, 'EACCES: permission denied'));

        const done = vi.fn();
        await useAutoFixStore.getState().run(done);

        const [result] = useAutoFixStore.getState().files;
        expect(result?.status).toBe('failed');
        expect(result?.error).toBe('EACCES: permission denied');
        expect(done).toHaveBeenCalledWith(
            expect.objectContaining({ applied: 0, failed: 1, stopped: false })
        );
    });

    it('reports applied files in the summary', async () => {
        reset([file('/music/a.flac')]);
        vi.mocked(smartFetch)
            .mockResolvedValueOnce(ok({ data: { title: 'Real', artist: 'Band' } }))
            .mockResolvedValueOnce(ok({ success: true }));

        const done = vi.fn();
        await useAutoFixStore.getState().run(done);

        expect(useAutoFixStore.getState().files[0]?.status).toBe('applied');
        expect(done).toHaveBeenCalledWith(
            expect.objectContaining({ applied: 1, failed: 0, notFound: 0 })
        );
    });

    it('ignores a list reload while a run is in progress', async () => {
        reset([file('/music/a.flac')]);
        useAutoFixStore.setState({ running: true });

        // A tab switch refetches the list; accepting it mid-run would wipe the
        // live per-file progress the loop is writing.
        useAutoFixStore.getState().setFiles([file('/music/other.flac')]);

        expect(useAutoFixStore.getState().files[0]?.filePath).toBe('/music/a.flac');
    });

    it('stops before the next file once stop is requested', async () => {
        reset([file('/music/a.flac'), file('/music/b.flac')]);
        vi.mocked(smartFetch).mockImplementation(async (url: string) => {
            if (url.includes('identify')) return ok({ data: { title: 'Real', artist: 'Band' } });
            useAutoFixStore.getState().stop();
            return ok({ success: true });
        });

        const done = vi.fn();
        await useAutoFixStore.getState().run(done);

        const files = useAutoFixStore.getState().files;
        expect(files[0]?.status).toBe('applied');
        expect(files[1]?.status).toBe('pending');
        expect(done).toHaveBeenCalledWith(expect.objectContaining({ applied: 1, stopped: true }));
        expect(useAutoFixStore.getState().running).toBe(false);
    });

    it('refuses to start a second concurrent run', async () => {
        reset([file('/music/a.flac')]);
        useAutoFixStore.setState({ running: true });

        await useAutoFixStore.getState().run();

        expect(smartFetch).not.toHaveBeenCalled();
    });
});
