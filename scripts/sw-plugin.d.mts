import type { Plugin } from 'vite';

export interface PrecacheEntry {
  file: string;
  content: string | Uint8Array;
}
export declare function readSwTemplate(): string;
export declare function shouldPrecache(file: string): boolean;
export declare function buildServiceWorker(entries: readonly PrecacheEntry[], template: string): string;
export declare function serviceWorkerPlugin(): Plugin;
