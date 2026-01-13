export function parseSelection(input: string, max: number): number[] {
    const indices = new Set<number>();

    const parts = input.split(/[, ]+/);

    for (const part of parts) {
        if (!part.trim()) continue;

        const subParts = part.split('-');

        if (subParts.length > 2) {
            const nums = subParts.map((s) => parseInt(s));
            if (nums.some(isNaN)) continue;

            for (const num of nums) {
                if (!isNaN(num) && num >= 1 && num <= max) indices.add(num - 1);
            }
        } else if (subParts.length === 2) {
            const nums = subParts.map((s) => parseInt(s));
            if (nums.some(isNaN)) continue;

            const start = nums[0];
            const end = nums[1];

            const low = Math.min(start, end);
            const high = Math.max(start, end);
            for (let i = low; i <= high; i++) {
                if (i >= 1 && i <= max) indices.add(i - 1);
            }
        } else {
            const num = parseInt(part);
            if (!isNaN(num) && num >= 1 && num <= max) {
                indices.add(num - 1);
            }
        }
    }

    return Array.from(indices).sort((a, b) => a - b);
}

export function validateSelection(input: string, max: number): string | boolean {
    if (!input || input.trim().length === 0) return 'Please enter a selection';

    if (!/^[\d\s,-]+$/.test(input)) {
        return 'Invalid format. Use numbers, commas, and hyphens (e.g., 1, 3-5)';
    }

    if (input.trim() === '0') return true;

    const indices = parseSelection(input, max);
    if (indices.length === 0) {
        return `Please enter numbers between 1 and ${max}`;
    }

    return true;
}
