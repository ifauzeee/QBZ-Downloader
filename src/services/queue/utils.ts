export function generateQueueId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}