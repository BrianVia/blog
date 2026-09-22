/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				paper: {
					DEFAULT: 'var(--paper)',
					2: 'var(--paper-2)',
				},
				ink: {
					DEFAULT: 'var(--ink)',
					2: 'var(--ink-2)',
					3: 'var(--ink-3)',
				},
				line: 'var(--line)',
				accent: 'var(--accent)',
				code: 'var(--code-bg)',
			},
			fontFamily: {
				serif: ['Newsreader', 'Georgia', 'Times New Roman', 'serif'],
				display: ['Fraunces', 'Georgia', 'serif'],
				mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
			},
		},
	},
	plugins: [],
}
