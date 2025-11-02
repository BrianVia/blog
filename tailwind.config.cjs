/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				primary: {
					DEFAULT: '#222222',
					50: '#f7f7f7',
					100: '#eaeaea',
					200: '#d5d5d5',
					300: '#bbbbbb',
					400: '#888888',
					500: '#666666',
					600: '#444444',
					700: '#333333',
					800: '#222222',
					900: '#111111',
				},
				secondary: {
					DEFAULT: '#334444',
					50: '#f0f0f0',
					100: '#e5e5e5',
					200: '#d0d0d0',
					300: '#a8a8a8',
					400: '#707070',
					500: '#556666',
					600: '#445555',
					700: '#334444',
					800: '#223333',
					900: '#112222',
				},
				accent: {
					DEFAULT: '#888888',
					light: '#cccccc',
					dark: '#666666',
				},
			},
			fontFamily: {
				sans: ['IBM Plex Serif', 'Times New Roman', 'serif'],
				heading: ['Playfair Display', 'IBM Plex Serif', 'serif'],
				mono: ['IBM Plex Mono', 'Courier New', 'monospace'],
			},
			boxShadow: {
				'retro': '0 2px 8px #eeeeee',
				'retro-lg': '0 4px 12px #dddddd',
				'retro-img': '0 2px 6px #cccccc',
			},
		},
	},
	plugins: [require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio'),],
}
