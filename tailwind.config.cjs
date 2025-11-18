/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				paper: 'var(--color-paper)',
				ink: {
					DEFAULT: 'var(--color-ink)',
					light: '#575757', // Static gray for suble text
					lighter: '#8a8a8a', // Static light gray
				},
				accent: {
					DEFAULT: 'var(--color-accent)',
					hover: '#A93226', // Keep static for now or use var if needed
				},
				secondary: {
					DEFAULT: '#5D6D7E', 
					light: '#AEB6BF',
				}
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', 'sans-serif'],
				serif: ['Merriweather', 'Georgia', 'serif'],
				heading: ['Playfair Display', 'Times New Roman', 'serif'],
				mono: ['JetBrains Mono', 'IBM Plex Mono', 'monospace'],
			},
			boxShadow: {
				'editorial': '0 4px 20px rgba(0, 0, 0, 0.05)',
				'editorial-hover': '0 10px 30px rgba(0, 0, 0, 0.08)',
			},
		},
	},
	plugins: [require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio'),],
}
