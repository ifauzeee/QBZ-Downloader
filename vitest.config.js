export default {
    test: {
        environment: 'node',
        // scripts/ is included so the release-build helpers are covered too —
        // a silent regression there ships a broken artifact rather than
        // failing a test.
        include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
        globals: true,
    },
};
