import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/components/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/app/**/*.{js,ts,jsx,tsx,mdx}",
	],
	theme: {
		extend: {
			fontFamily: {
				sans: [
					'var(--font-archivo)',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'Roboto',
					'Helvetica',
					'Arial',
					'sans-serif',
				],
			},
			colors: {
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					active: 'hsl(var(--primary-active))',
					50: 'hsl(var(--primary-50))',
					100: 'hsl(var(--primary-100))',
					200: 'hsl(var(--primary-200))',
					300: 'hsl(var(--primary-300))',
					400: 'hsl(var(--primary-400))',
					500: 'hsl(var(--primary-500))',
					600: 'hsl(var(--primary-600))',
					700: 'hsl(var(--primary-700))',
					800: 'hsl(var(--primary-800))',
					900: 'hsl(var(--primary-900))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					hover: 'hsl(var(--accent-hover))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				healthy: {
					DEFAULT: 'hsl(var(--healthy))',
					foreground: 'hsl(var(--healthy-foreground))'
				},
				/* Warning had no token, so ~107 sites hardcoded amber-500. Hue 42
				   sits far enough from the lamp (17) to stay separable. */
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				/* Accent TEXT that clears AA on a paper well. --primary is a
				   signal colour and is not safe at body size. */
				'lamp-ink': 'hsl(var(--lamp-ink))',
				/* The indicator itself: lit rails and pips, never body text. */
				lamp: 'hsl(var(--lamp))',
				border: 'hsl(var(--border))',
				/* The darker top edge that makes a well read as recessed. */
				'rule-strong': 'hsl(var(--rule-strong))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			/*
				The whole scale is remapped, not just the token steps.

				Roughly 1,600 call sites across the app hardcode `rounded-xl`,
				`rounded-2xl` and `rounded-3xl`, which resolve against Tailwind's
				own scale and would otherwise ignore --radius entirely. Collapsing
				the scale here retires the soft 12–24px shell in one edit instead
				of 1,600, and keeps every future `rounded-*` inside the system.

				`full` is kept: avatars, status dots and spinners are genuinely
				circular. Pill BUTTONS are not — those are squared at the two
				button components, since the pill is one of this product's
				strongest recognition tells.
			*/
			/*
				383 call sites use the default shadow scale, so the scale itself
				is redefined rather than the call sites.

				sm / DEFAULT / md land on resting surfaces (cards, rows, fields):
				those are RECESSED here, so they get the engraved top edge and no
				drop at all. lg / xl / 2xl land on things that genuinely float
				above the panel (menus, popovers, modals, drawers) and keep real
				depth — tight offset, low blur, near-black — because an overlay
				that does not separate from the content under it is a usability
				bug, not a purity win.
			*/
			boxShadow: {
				none: 'none',
				sm: 'inset 0 1px 0 hsl(var(--rule-strong))',
				DEFAULT: 'inset 0 1px 0 hsl(var(--rule-strong))',
				md: 'inset 0 1px 0 hsl(var(--rule-strong))',
				lg: '0 2px 8px -2px hsl(220 20% 4% / 0.28)',
				xl: '0 4px 14px -4px hsl(220 20% 4% / 0.34)',
				'2xl': '0 8px 24px -6px hsl(220 20% 4% / 0.40)',
				inner: 'inset 0 1px 2px hsl(220 20% 4% / 0.14)'
			},
			borderRadius: {
				none: '0px',
				sm: '1px',
				DEFAULT: 'var(--radius)',
				md: 'var(--radius)',
				lg: 'var(--radius)',
				xl: 'var(--radius)',
				'2xl': '3px',
				'3xl': '4px',
				full: '9999px'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
			},
			/*
				State only. An operator sits in this app for a full shift, so
				nothing in the periphery is allowed to move on a loop; the
				accordion collapse survives because it reports a state change.
			*/
			animation: {
				'accordion-down': 'accordion-down 0.16s cubic-bezier(.2,0,0,1)',
				'accordion-up': 'accordion-up 0.16s cubic-bezier(.2,0,0,1)'
			},
			transitionTimingFunction: {
				DEFAULT: 'cubic-bezier(.2,0,0,1)',
				panel: 'cubic-bezier(.2,0,0,1)'
			},
			transitionDuration: {
				DEFAULT: '120ms'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
