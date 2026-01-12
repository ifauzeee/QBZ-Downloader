/**
 * Parses a selection string (e.g., "1, 3-5, 7") into an array of 0-based indices.
 *
 * @param {string} input - The input string from the user
 * @param {number} max - The maximum valid number (1-based)
 * @returns {number[]} - Array of unique 0-based indices, sorted ascending
 */
export function parseSelection(input, max) {
    const indices = new Set();

    const parts = input.split(/[, ]+/);

    for (const part of parts) {
        if (!part.trim()) continue;

        const subParts = part.split('-');

        if (subParts.length >= 2) {
            const nums = subParts.map((s) => parseInt(s));
            if (nums.some(isNaN)) continue;

            const start = nums[0];
            const end = nums[1];

            const low = Math.min(start, end);
            const high = Math.max(start, end);
            for (let i = low; i <= high; i++) {
                if (i >= 1 && i <= max) indices.add(i - 1);
            }

            for (let i = 2; i < nums.length; i++) {
                const num = nums[i];
                if (num >= 1 && num <= max) indices.add(num - 1);
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

/**
 * Validates a selection string.
 *
 * @param {string} input - The input string
 * @param {number} max - The maximum valid number
 * @returns {boolean|string} - True if valid, or error message
 */
export function validateSelection(input, max) {
    if (!input || input.trim().length === 0) return 'Please enter a selection';

    if (!/^[\d\s,-]+$/.test(input)) {
        return 'Invalid format. Use numbers, commas, and hyphens (e.g., 1, 3-5)';
    }

    const indices = parseSelection(input, max);
    if (indices.length === 0) {
        return `Please enter numbers between 1 and ${max}`;
    }

    return true;
}
