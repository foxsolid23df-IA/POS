import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	base: './',
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules')) return;
					if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
					if (id.includes('@supabase')) return 'vendor-supabase';
					if (id.includes('xlsx')) return 'vendor-xlsx';
					if (id.includes('html5-qrcode') || id.includes('@zxing')) return 'vendor-scanner';
					if (id.includes('@capacitor')) return 'vendor-capacitor';
					if (id.includes('sweetalert2') || id.includes('framer-motion') || id.includes('lucide-react') || id.includes('react-icons')) return 'vendor-ui';
					return 'vendor';
				}
			}
		}
	}
})
