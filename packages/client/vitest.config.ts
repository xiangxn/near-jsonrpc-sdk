import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@near-js/jsonrpc-types': path.resolve(__dirname, '../types/src'),
        },
    },
    test: {
        include: ['tests/*.test.ts'],
        setupFiles: ['tests/setup.ts'],
        globals: true,
    },

});
