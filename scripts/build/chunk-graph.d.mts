import type { OutputBundle } from 'rollup';
import type { Plugin } from 'vite';

export function validateChunkGraph(bundle: OutputBundle): void;
export function chunkGraphGuard(): Plugin;
