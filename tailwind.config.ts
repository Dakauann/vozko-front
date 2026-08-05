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
			/*
				Inter. Neither reference face is licensable for the web — one is
				a system font, the other is proprietary — and Inter is the
				closest honest stand-in for both: it is the register one of them
				actually ships its dashboard in, and a clean substitute for the
				other. It replaces a squarer, more mechanical grotesque that was
				chosen to serve the retired panel identity and carried a lot of
				its dated character.

				Segoe UI stays high in the stack, not as a fallback formality:
				on the Windows machines a large share of these operators use, it
				is the native face of the system this design borrows from.
			*/
			fontFamily: {
				sans: [
					'var(--font-inter)',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI Variable Text',
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
					foreground: 'hsl(var(--destructive-foreground))',
					ink: 'hsl(var(--destructive-ink))'
				},
				healthy: {
					DEFAULT: 'hsl(var(--healthy))',
					foreground: 'hsl(var(--healthy-foreground))',
					ink: 'hsl(var(--healthy-ink))'
				},
				/* Warning had no token, so ~107 sites hardcoded amber-500. Hue 42
				   sits far enough from the lamp (17) to stay separable. */
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))',
					ink: 'hsl(var(--warning-ink))'
				},
				/* Accent TEXT that clears AA on a white sheet. --primary is a
				   fill colour and is not safe at body size. */
				'primary-ink': 'hsl(var(--primary-ink))',
				/* The tinted ground under a selected row or a soft badge. */
				'primary-subtle': {
					DEFAULT: 'hsl(var(--primary-subtle))',
					hover: 'hsl(var(--primary-subtle-hover))'
				},
				/* Informational, non-brand. */
				info: {
					DEFAULT: 'hsl(var(--info))',
					foreground: 'hsl(var(--info-foreground))',
					ink: 'hsl(var(--info-ink))'
				},
				/* Legacy aliases from the retired identity. Kept registered so
				   no call site loses its colour mid-migration; both resolve to
				   the brand tokens above. */
				'lamp-ink': 'hsl(var(--lamp-ink))',
				lamp: 'hsl(var(--lamp))',
				border: 'hsl(var(--border))',
				/* The deliberate step up from a hairline: field edges, resting
				   controls, the rule under a table head. */
				'border-strong': 'hsl(var(--border-strong))',
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
				The elevation scale, remapped at the scale rather than at the
				~390 call sites that use it.

				The retired identity resolved sm / DEFAULT / md to an INSET rule
				and no drop at all, because its surfaces were cut into a panel
				rather than laid on it. That inversion is over: every step is a
				real, layered drop shadow again, tinted slate rather than black
				(see --elev-* in globals.css for why). The practical effect is
				that ~390 call sites that currently render a machined groove
				start rendering a sheet, with no edit to any of them.

				`inner` survives as a genuine inset for the few places that want
				a recess on purpose — a progress track, a scrub bar — rather
				than as the resting state of every surface in the product.
			*/
			boxShadow: {
				none: 'none',
				sm: 'var(--elev-1)',
				DEFAULT: 'var(--elev-2)',
				md: 'var(--elev-3)',
				lg: 'var(--elev-4)',
				xl: 'var(--elev-5)',
				'2xl': 'var(--elev-6)',
				inner: 'inset 0 1px 2px 0 hsl(228 40% 28% / 0.08)',
				/* Named steps for the two controls that own their own depth. */
				button: 'var(--elev-button)',
				'button-hover': 'var(--elev-button-hover)',
				quiet: 'var(--elev-button-quiet)',
				'quiet-hover': 'var(--elev-button-quiet-hover)'
			},
			/*
				A real radius ramp, remapped at the scale.

				~1,030 call sites write `rounded-[--radius]` and ~1,440 write
				`rounded-{lg,xl,2xl,3xl}`. The retired identity collapsed all of
				them onto a single flat 2px, which is a large part of why the UI
				read as pre-2010 software — one corner value for a checkbox, a
				button, a card and a modal is not a system, it is the absence of
				one.

				So the steps are given real, distinct values in the range both
				reference systems work in: 4px on the smallest chips, 6px on
				controls, 8px on surfaces, 10-16px on the large containers and
				overlays. Every existing call site lands somewhere sensible on
				that ramp without being touched.

				`full` is kept for things that are genuinely circular — avatars,
				status dots, spinners, switch and checkbox thumbs, and the
				selection bar.
			*/
			borderRadius: {
				none: '0px',
				sm: '4px',
				DEFAULT: 'var(--radius)',
				md: 'var(--radius)',
				lg: '8px',
				xl: '10px',
				'2xl': '12px',
				'3xl': '16px',
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
				/*
					The typing / working indicator.

					Replaces Tailwind's `animate-bounce`, whose springy
					translate reads as a toy. A row of dots reporting that the
					system is thinking should breathe, not hop.
				*/
				'dot-pulse': {
					'0%, 80%, 100%': { opacity: '0.25', transform: 'scale(0.8)' },
					'40%': { opacity: '1', transform: 'scale(1)' }
				},
			},
			/*
				State only. An operator sits in this app for a full shift, so
				nothing in the periphery is allowed to move on a loop; the
				accordion collapse survives because it reports a state change.
				That rule is inherited unchanged — it was right.

				The curves are not. These are the reference system's motion
				curves: a symmetric ease for anything that changes in place
				(colour, opacity, a control settling), and a decelerate curve
				for anything that ARRIVES — a panel, a drawer, a menu — because
				something entering the frame should land rather than coast.
				150ms replaces 120ms: fast enough to feel immediate, long enough
				that the eye reads it as motion instead of a jump.
			*/
			animation: {
				'accordion-down': 'accordion-down 0.2s cubic-bezier(0.1,0.9,0.2,1)',
				'accordion-up': 'accordion-up 0.2s cubic-bezier(0.1,0.9,0.2,1)',
				/* Loops, and allowed to: it reports live work in progress,
				   which is a state, not decoration. */
				'dot-pulse': 'dot-pulse 1.2s cubic-bezier(0.33,0,0.67,1) infinite'
			},
			transitionTimingFunction: {
				DEFAULT: 'cubic-bezier(0.33,0,0.67,1)',
				panel: 'cubic-bezier(0.1,0.9,0.2,1)',
				exit: 'cubic-bezier(0.9,0.1,1,0.2)'
			},
			transitionDuration: {
				DEFAULT: '150ms'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
