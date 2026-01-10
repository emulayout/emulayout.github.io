import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		// Compress assets with brotli for modern browsers (better compression than gzip)
		viteCompression({
			algorithm: 'brotliCompress',
			ext: '.br',
			threshold: 1024 // Only compress files larger than 1KB
		})
	]
});
