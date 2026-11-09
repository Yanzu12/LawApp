/** @type {import('tailwindcss').Config} */
module.exports = {
	darkMode: ['class'],
	content: [
		'./pages/**/*.{ts,tsx}',
		'./components/**/*.{ts,tsx}',
		'./app/**/*.{ts,tsx}',
		'./src/**/*.{ts,tsx}',
	],
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px',
			},
		},
		extend: {
			colors: {
				paper: 'var(--paper)',
				'paper-deep': 'var(--paper-deep)',
				card: 'var(--card)',
				'card-2': 'var(--card-2)',
				ink: 'var(--ink)',
				'ink-2': 'var(--ink-2)',
				'ink-3': 'var(--ink-3)',
				rule: 'var(--rule)',
				'rule-strong': 'var(--rule-strong)',
				action: 'var(--action)',
				'action-ink': 'var(--action-ink)',
				'action-soft': 'var(--action-soft)',
				seal: 'var(--seal)',
				'seal-ink': 'var(--seal-ink)',
				'seal-soft': 'var(--seal-soft)',
				ok: 'var(--ok)',
				'ok-ink': 'var(--ok-ink)',
				'ok-soft': 'var(--ok-soft)',
				warn: 'var(--warn)',
				'warn-ink': 'var(--warn-ink)',
				'warn-soft': 'var(--warn-soft)',
			},
			fontFamily: {
				sans: 'var(--font-sans)',
				serif: 'var(--font-serif)',
				mono: 'var(--font-mono)',
			},
			borderRadius: {
				DEFAULT: 'var(--radius)',
			},
			keyframes: {
				'accordion-down': {
					from: { height: 0 },
					to: { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: 0 },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
			},
		},
	},
	plugins: [require('tailwindcss-animate')],
}