import { Transform, TransformCallback } from 'stream';

export class ThrottleStream extends Transform {
    private bytesRead = 0;
    private startTime: number = Date.now();
    private limit: number;

    constructor(limitKbps: number) {
        super();
        this.limit = limitKbps * 1024;
    }

    _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
        if (this.limit <= 0) {
            this.push(chunk);
            callback();
            return;
        }

        this.bytesRead += chunk.length;
        const now = Date.now();
        const elapsed = (now - this.startTime) / 1000;
        const expectedTime = this.bytesRead / this.limit;

        if (elapsed < expectedTime) {
            const delay = (expectedTime - elapsed) * 1000;
            setTimeout(() => {
                this.push(chunk);
                callback();
            }, delay);
        } else {
            this.push(chunk);
            callback();
        }
    }
}
