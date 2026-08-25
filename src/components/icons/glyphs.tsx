/**
 * Icon glyphs — GENERATED, do not hand-edit.
 *
 * The app's own 208 drawings, 24x24, 1.5 stroke. Each carries two colour
 * layers: the base stroke follows `currentColor`, and the accent parts use
 * `--icon-accent` (set in globals.css to the brand's --primary-ink, which
 * already flips between themes).
 *
 * Source of truth: ./svg/*.svg. Regenerate with `emit_vozko.py` in
 * ~/icon-system. Names here are internal; ./index.tsx maps the vozko export
 * names onto them.
 */
"use client";

import * as React from "react";

import type { Icon } from "./types";

const ACCENT = "var(--icon-accent, currentColor)";

/**
 * Optical sizing.
 *
 * `strokeWidth` is expressed in viewBox units, so a fixed 1.5 on a 24 grid
 * renders as `1.5 * size / 24` device pixels. This app calls icons at 10-16px
 * far more than anywhere else (size={14} alone is 66 call sites), where a fixed
 * 1.5 lands at 0.88px — thinner than the Inter it sits beside, which is exactly
 * the washed-out look. Tabler had the same falloff and got away with it on
 * simpler geometry.
 *
 * So solve for constant APPARENT weight instead of constant nominal weight:
 * pick the device-pixel target, divide back out, clamp the ends so tiny icons
 * do not turn into blobs and 32px+ ones do not turn into hairlines.
 *
 * Not a flat apparent weight, though: a gentle ramp. Pure compensation would
 * make a 32px icon as thin as a 12px one, and large marks want a little more
 * presence. The `+ 0.35` tilts it so apparent weight rises slowly with size —
 * 1.2px at 12, 1.35px at 14, 1.5px at 24, 2px at 32.
 */
function strokeFor(size: number): number {
  const w = 27.6 / size + 0.35;
  return Math.min(2.4, Math.max(1.5, Math.round(w * 100) / 100));
}

/** `size` is typed `number | string`; normalise before doing arithmetic. */
function toPx(size: number | string): number {
  if (typeof size === "number") return size;
  return Number.parseFloat(size) || DEFAULT_SIZE;
}

/**
 * 16, not Tabler's 24. Only a couple of call sites omit `size`, and every one
 * of them sits inline with text where 24 was already too big.
 */
const DEFAULT_SIZE = 16;

/**
 * Same call signature the app already uses, so no consumer changes:
 *   - `size` sets width and height (default 16) and drives the stroke
 *   - `weight` is accepted and ignored, exactly as under Tabler
 *   - `mirrored` flips on X
 *   - `color` overrides the base stroke; the accent stays branded
 *
 * stroke-linecap / stroke-linejoin are plain presentation attributes, so a CSS
 * rule on the element still wins — that is what lets `.vz-icon--sharp` swap the
 * terminal profile without a second copy of the geometry.
 */
function glyph(displayName: string, children: React.ReactNode): Icon {
  const Glyph: Icon = ({
    size = DEFAULT_SIZE,
    // Destructured precisely so it is swallowed and never reaches the SVG.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    weight: _weight,
    mirrored,
    color,
    style,
    ...rest
  }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke={color ?? "currentColor"}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{
        // Stroke goes through `style`, not the attribute, because it has to be
        // TWO things at once: the per-size optical ramp (a number only JS
        // knows) times the per-theme irradiation scale (a token only CSS
        // knows). calc() is the only place those meet. Caller `style` spreads
        // last, so an explicit override still wins.
        strokeWidth: `calc(${strokeFor(toPx(size))} * var(--icon-stroke-scale, 1))`,
        ...(mirrored ? { transform: "scaleX(-1)" } : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </svg>
  );
  Glyph.displayName = displayName;
  return Glyph;
}


export const Dashboard: Icon = /*#__PURE__*/ glyph(
  "Dashboard",
  <>
    <rect stroke={ACCENT} x="3.25" y="3.25" width="7.5" height="7.5" rx="1.75" />
    <rect x="13.25" y="3.25" width="7.5" height="7.5" rx="1.75" />
    <rect x="3.25" y="13.25" width="7.5" height="7.5" rx="1.75" />
    <rect x="13.25" y="13.25" width="7.5" height="7.5" rx="1.75" />
  </>,
);

export const Leads: Icon = /*#__PURE__*/ glyph(
  "Leads",
  <>
    <circle cx="10.25" cy="8.5" r="3.9" />
    <path d="M3.5 20.75a6.75 6.75 0 0 1 13.5 0" />
    <path stroke={ACCENT} d="M19.25 4.5v4.5M21.5 6.75H17" />
  </>,
);

export const Clientes: Icon = /*#__PURE__*/ glyph(
  "Clientes",
  <>
    <circle cx="9.5" cy="8.5" r="3.4" />
    <path d="M3.5 19.9a6 6 0 0 1 12 0" />
    <path stroke={ACCENT} d="M15.9 5.4a3.4 3.4 0 0 1 0 6.2" />
    <path stroke={ACCENT} d="M17 14.4a6 6 0 0 1 4.5 5.5" />
  </>,
);

export const Oportunidades: Icon = /*#__PURE__*/ glyph(
  "Oportunidades",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="12" cy="12" r="4.75" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="12" r="1.9" />
  </>,
);

export const Atividades: Icon = /*#__PURE__*/ glyph(
  "Atividades",
  <>
    <rect x="3.25" y="4.5" width="17.5" height="16" rx="2.75" />
    <path stroke={ACCENT} d="M3.25 9.25h17.5" />
    <path d="M7.5 13.25h9M7.5 16.75h5.5" />
  </>,
);

export const Tarefas: Icon = /*#__PURE__*/ glyph(
  "Tarefas",
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3.75" />
    <path stroke={ACCENT} d="m8.25 12.15 2.7 2.7 5.05-5.7" />
  </>,
);

export const Agenda: Icon = /*#__PURE__*/ glyph(
  "Agenda",
  <>
    <rect x="3.25" y="5" width="17.5" height="15.75" rx="2.75" />
    <path d="M8 3.25v3.5M16 3.25v3.5" />
    <path d="M3.25 10h17.5" />
    <rect fill={ACCENT} stroke="none" x="6.9" y="12.9" width="3.4" height="3.4" rx="1" />
  </>,
);

export const Mensagens: Icon = /*#__PURE__*/ glyph(
  "Mensagens",
  <>
    <path d="M7 4h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-4.5 3.9a.6.6 0 0 1-1-.45V16H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
    <circle cx="8.6" cy="10" r="1.0" fill={ACCENT} stroke="none" /><circle cx="12" cy="10" r="1.0" fill={ACCENT} stroke="none" /><circle cx="15.4" cy="10" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Negocios: Icon = /*#__PURE__*/ glyph(
  "Negocios",
  <>
    <rect x="3" y="7.25" width="18" height="13.5" rx="2.75" />
    <path stroke={ACCENT} d="M8.75 7.25V5.9a2.4 2.4 0 0 1 2.4-2.4h1.7a2.4 2.4 0 0 1 2.4 2.4v1.35" />
    <path d="M3 12.75h18" />
    <path d="M10.5 12.75h3" />
  </>,
);

export const Funil: Icon = /*#__PURE__*/ glyph(
  "Funil",
  <>
    <path d="M3.75 5h16.5l-6.4 7.5v6.35a1 1 0 0 1-1.45.9l-2.1-1.05a1 1 0 0 1-.55-.9V12.5L3.75 5Z" />
    <path stroke={ACCENT} d="M6.9 8.75h10.2" />
  </>,
);

export const Documentos: Icon = /*#__PURE__*/ glyph(
  "Documentos",
  <>
    <path d="M14 3.25H7.5A2.5 2.5 0 0 0 5 5.75v12.5a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5V8.25L14 3.25Z" />
    <path stroke={ACCENT} d="M14 3.25v3.5a1.5 1.5 0 0 0 1.5 1.5H19" />
    <path d="M8.75 13h6.5M8.75 16.5h4.5" />
  </>,
);

export const Financeiro: Icon = /*#__PURE__*/ glyph(
  "Financeiro",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M12 6.5v11" />
    <path stroke={ACCENT} d="M14.85 9.55c-.5-1.05-1.6-1.65-2.95-1.65-1.75 0-2.95.95-2.95 2.2 0 1.35 1.15 1.9 2.95 2.2 1.95.32 3.1.85 3.1 2.2 0 1.3-1.35 2.25-3.1 2.25-1.45 0-2.55-.6-3.05-1.65" />
  </>,
);

export const Relatorios: Icon = /*#__PURE__*/ glyph(
  "Relatorios",
  <>
    <rect x="3.75" y="13" width="3.75" height="7.25" rx="1.4" />
    <rect x="10.15" y="8.25" width="3.75" height="12" rx="1.4" />
    <rect stroke={ACCENT} x="16.5" y="3.75" width="3.75" height="16.5" rx="1.4" />
  </>,
);

export const Configuracoes: Icon = /*#__PURE__*/ glyph(
  "Configuracoes",
  <>
    <path d="M10.08 4.85 L10.48 2.42 L13.52 2.42 L13.92 4.85 L15.70 5.59 L17.70 4.15 L19.85 6.30 L18.41 8.30 L19.15 10.08 L21.58 10.48 L21.58 13.52 L19.15 13.92 L18.41 15.70 L19.85 17.70 L17.70 19.85 L15.70 18.41 L13.92 19.15 L13.52 21.58 L10.48 21.58 L10.08 19.15 L8.30 18.41 L6.30 19.85 L4.15 17.70 L5.59 15.70 L4.85 13.92 L2.42 13.52 L2.42 10.48 L4.85 10.08 L5.59 8.30 L4.15 6.30 L6.30 4.15 L8.30 5.59 Z" />
    <circle stroke={ACCENT} cx="12" cy="12" r="3.2" />
  </>,
);

export const Usuarios: Icon = /*#__PURE__*/ glyph(
  "Usuarios",
  <>
    <circle stroke={ACCENT} cx="12" cy="8.25" r="4" />
    <path d="M4.5 20.75a7.5 7.5 0 0 1 15 0" />
  </>,
);

export const Suporte: Icon = /*#__PURE__*/ glyph(
  "Suporte",
  <>
    <path d="M4.75 13.5v-1.75a7.25 7.25 0 0 1 14.5 0v1.75" />
    <rect stroke={ACCENT} x="2.5" y="12" width="4.6" height="6.6" rx="2.3" />
    <rect stroke={ACCENT} x="16.9" y="12" width="4.6" height="6.6" rx="2.3" />
    <path d="M19.2 18.6v.65a2.5 2.5 0 0 1-2.5 2.5H13.5" />
  </>,
);

export const Adicionar: Icon = /*#__PURE__*/ glyph(
  "Adicionar",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M12 7.9v8.2M7.9 12h8.2" />
  </>,
);

export const Editar: Icon = /*#__PURE__*/ glyph(
  "Editar",
  <>
    <path d="M19.5 7.5 8 19l-4 1 1-4L16.5 4.5l3 3Z" />
    <path stroke={ACCENT} d="M16.5 4.5 18 3a2.12 2.12 0 0 1 3 3l-1.5 1.5" />
  </>,
);

export const Excluir: Icon = /*#__PURE__*/ glyph(
  "Excluir",
  <>
    <path d="M4.5 6.75h15" />
    <path stroke={ACCENT} d="M9.5 6.75V5.6a2.1 2.1 0 0 1 2.1-2.1h.8a2.1 2.1 0 0 1 2.1 2.1v1.15" />
    <path d="M6.75 6.75 7.55 19.1A2 2 0 0 0 9.55 21h4.9a2 2 0 0 0 2-1.9l.8-12.35" />
    <path d="M10.3 10.6v6.3M13.7 10.6v6.3" />
  </>,
);

export const Visualizar: Icon = /*#__PURE__*/ glyph(
  "Visualizar",
  <>
    <path d="M2.25 12S6 5.25 12 5.25 21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
    <circle stroke={ACCENT} cx="12" cy="12" r="3.25" />
  </>,
);

export const Filtros: Icon = /*#__PURE__*/ glyph(
  "Filtros",
  <>
    <path d="M3.5 6.5h4.4M12 6.5h8.5" />
    <path d="M3.5 12h9.4M17 12h3.5" />
    <path d="M3.5 17.5h2.4M10 17.5h10.5" />
    <circle stroke={ACCENT} cx="9.95" cy="6.5" r="2.05" />
    <circle stroke={ACCENT} cx="14.95" cy="12" r="2.05" />
    <circle stroke={ACCENT} cx="7.95" cy="17.5" r="2.05" />
  </>,
);

export const Exportar: Icon = /*#__PURE__*/ glyph(
  "Exportar",
  <>
    <path d="M4.5 15.25v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
    <path stroke={ACCENT} d="M12 3.25v12M7.6 10.85 12 15.25l4.4-4.4" />
  </>,
);

export const Importar: Icon = /*#__PURE__*/ glyph(
  "Importar",
  <>
    <path d="M4.5 15.25v3a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
    <path stroke={ACCENT} d="M12 15.25v-12M7.6 7.65 12 3.25l4.4 4.4" />
  </>,
);

export const Buscar: Icon = /*#__PURE__*/ glyph(
  "Buscar",
  <>
    <circle cx="10.75" cy="10.75" r="6.75" />
    <path stroke={ACCENT} d="m15.65 15.65 4.85 4.85" />
  </>,
);

export const Menu: Icon = /*#__PURE__*/ glyph(
  "Menu",
  <>
    <path d="M3.5 6.5h17M3.5 17.5h17" />
    <path stroke={ACCENT} d="M3.5 12h17" />
  </>,
);

export const Fechar: Icon = /*#__PURE__*/ glyph(
  "Fechar",
  <>
    <path d="m5.75 5.75 12.5 12.5" />
    <path stroke={ACCENT} d="m18.25 5.75-12.5 12.5" />
  </>,
);

export const Notificacoes: Icon = /*#__PURE__*/ glyph(
  "Notificacoes",
  <>
    <path d="M18 9.75a6 6 0 1 0-12 0c0 5.25-2.25 6.9-2.25 6.9h16.5S18 15 18 9.75Z" />
    <path d="M13.9 19.75a2.2 2.2 0 0 1-3.8 0" />
    <circle fill={ACCENT} stroke="none" cx="18.1" cy="5.6" r="2.8" />
  </>,
);

export const Alerta: Icon = /*#__PURE__*/ glyph(
  "Alerta",
  <>
    <path d="M10.28 4.2 2.6 17.5a2 2 0 0 0 1.72 3h15.36a2 2 0 0 0 1.72-3L13.72 4.2a2 2 0 0 0-3.44 0Z" />
    <path stroke={ACCENT} d="M12 9.5v4.4" />
    <circle cx="12" cy="17.4" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Sucesso: Icon = /*#__PURE__*/ glyph(
  "Sucesso",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="m8.15 12.15 2.7 2.7 5.05-5.7" />
  </>,
);

export const Atencao: Icon = /*#__PURE__*/ glyph(
  "Atencao",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M12 7.5v5.25" />
    <circle cx="12" cy="16.3" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Informacao: Icon = /*#__PURE__*/ glyph(
  "Informacao",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M12 11.25v5.25" />
    <circle cx="12" cy="7.9" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Ajuda: Icon = /*#__PURE__*/ glyph(
  "Ajuda",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M9.55 9.5a2.55 2.55 0 0 1 4.95.85c0 1.7-2.55 2.55-2.55 2.55v.9" />
    <circle cx="12" cy="16.6" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Spinner: Icon = /*#__PURE__*/ glyph(
  "Spinner",
  <>
    <circle cx="12" cy="12" r="8.75" opacity=".28" />
    <path stroke={ACCENT} d="M20.75 12A8.75 8.75 0 0 0 12 3.25" />
  </>,
);

export const Check: Icon = /*#__PURE__*/ glyph(
  "Check",
  <>
    <path stroke={ACCENT} d="m4.75 12.6 4.9 4.9L19.25 6.5" />
  </>,
);

export const Checks: Icon = /*#__PURE__*/ glyph(
  "Checks",
  <>
    <path d="m2.25 12.4 4.2 4.2 4.1-4.35" />
    <path stroke={ACCENT} d="m8.6 12.4 4.2 4.2 8.95-9.5" />
  </>,
);

export const XCircle: Icon = /*#__PURE__*/ glyph(
  "XCircle",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="m9.15 9.15 5.7 5.7M14.85 9.15l-5.7 5.7" />
  </>,
);

export const Circle: Icon = /*#__PURE__*/ glyph(
  "Circle",
  <>
    <circle stroke={ACCENT} cx="12" cy="12" r="8.75" />
  </>,
);

export const Square: Icon = /*#__PURE__*/ glyph(
  "Square",
  <>
    <rect stroke={ACCENT} x="3.75" y="3.75" width="16.5" height="16.5" rx="3.5" />
  </>,
);

export const Prohibit: Icon = /*#__PURE__*/ glyph(
  "Prohibit",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="m5.8 5.8 12.4 12.4" />
  </>,
);

export const Hourglass: Icon = /*#__PURE__*/ glyph(
  "Hourglass",
  <>
    <path d="M6.5 3.25h11M6.5 20.75h11" />
    <path d="M7.75 3.25v3.2a2 2 0 0 0 .62 1.45L12 11.4l3.63-3.5a2 2 0 0 0 .62-1.45v-3.2" />
    <path stroke={ACCENT} d="M7.75 20.75v-3.2a2 2 0 0 1 .62-1.45L12 12.6l3.63 3.5a2 2 0 0 1 .62 1.45v3.2" />
  </>,
);

export const Timer: Icon = /*#__PURE__*/ glyph(
  "Timer",
  <>
    <circle cx="12" cy="13.75" r="7.5" />
    <path d="M9.25 2.75h5.5" />
    <path stroke={ACCENT} d="M12 9.75v4h3.25" />
  </>,
);

export const ShieldWarning: Icon = /*#__PURE__*/ glyph(
  "ShieldWarning",
  <>
    <path d="M12 21.25s7.25-3.25 7.25-9.25V5.9L12 3.15 4.75 5.9v6.1c0 6 7.25 9.25 7.25 9.25Z" />
    <path stroke={ACCENT} d="M12 8.25v4.25" />
    <circle cx="12" cy="15.9" r="1.0" fill={ACCENT} stroke="none" />
  </>,
);

export const Confetti: Icon = /*#__PURE__*/ glyph(
  "Confetti",
  <>
    <path d="M2.9 21.1 8.4 6.6l9 9-14.5 5.5Z" />
    <path d="m11.4 9.6 3 3" />
    <path stroke={ACCENT} d="M14.75 3.25v2.25M19.3 4.7l-1.6 1.6M20.75 9.25H18.5M18.5 13.25l1.6 1.6" />
  </>,
);

export const Flag: Icon = /*#__PURE__*/ glyph(
  "Flag",
  <>
    <path d="M5.25 21V3.5" />
    <path stroke={ACCENT} d="M5.25 4.5h14.25l-2.6 4.5 2.6 4.5H5.25" />
  </>,
);

export const Siren: Icon = /*#__PURE__*/ glyph(
  "Siren",
  <>
    <path d="M6.5 17.5v-3.75a5.5 5.5 0 0 1 11 0v3.75" />
    <rect x="3.75" y="17.5" width="16.5" height="3.75" rx="1.6" />
    <path stroke={ACCENT} d="M12 2.75v2.25M4.9 6.15 6.5 7.7M19.1 6.15 17.5 7.7" />
  </>,
);

export const CaretDown: Icon = /*#__PURE__*/ glyph(
  "CaretDown",
  <>
    <path stroke={ACCENT} d="m5.5 9 6.5 6.5L18.5 9" />
  </>,
);

export const CaretUp: Icon = /*#__PURE__*/ glyph(
  "CaretUp",
  <>
    <path stroke={ACCENT} d="m5.5 15 6.5-6.5L18.5 15" />
  </>,
);

export const CaretLeft: Icon = /*#__PURE__*/ glyph(
  "CaretLeft",
  <>
    <path stroke={ACCENT} d="M15 5.5 8.5 12 15 18.5" />
  </>,
);

export const CaretRight: Icon = /*#__PURE__*/ glyph(
  "CaretRight",
  <>
    <path stroke={ACCENT} d="m9 5.5 6.5 6.5L9 18.5" />
  </>,
);

export const CaretUpDown: Icon = /*#__PURE__*/ glyph(
  "CaretUpDown",
  <>
    <path stroke={ACCENT} d="m7.5 10 4.5-4.5 4.5 4.5" />
    <path d="m7.5 14 4.5 4.5 4.5-4.5" />
  </>,
);

export const ArrowLeft: Icon = /*#__PURE__*/ glyph(
  "ArrowLeft",
  <>
    <path d="M20 12H5" />
    <path stroke={ACCENT} d="m11 5.75-6.25 6.25L11 18.25" />
  </>,
);

export const ArrowRight: Icon = /*#__PURE__*/ glyph(
  "ArrowRight",
  <>
    <path d="M4 12h15" />
    <path stroke={ACCENT} d="m13 5.75 6.25 6.25L13 18.25" />
  </>,
);

export const ArrowUp: Icon = /*#__PURE__*/ glyph(
  "ArrowUp",
  <>
    <path d="M12 20V5" />
    <path stroke={ACCENT} d="m5.75 11 6.25-6.25L18.25 11" />
  </>,
);

export const ArrowDown: Icon = /*#__PURE__*/ glyph(
  "ArrowDown",
  <>
    <path d="M12 4v15" />
    <path stroke={ACCENT} d="m5.75 13 6.25 6.25L18.25 13" />
  </>,
);

export const ArrowUpRight: Icon = /*#__PURE__*/ glyph(
  "ArrowUpRight",
  <>
    <path d="M6.25 17.75 17.75 6.25" />
    <path stroke={ACCENT} d="M9 6.25h8.75V15" />
  </>,
);

export const ArrowBendUpLeft: Icon = /*#__PURE__*/ glyph(
  "ArrowBendUpLeft",
  <>
    <path d="M3.75 9.5h11a5.5 5.5 0 0 1 5.5 5.5v4.25" />
    <path stroke={ACCENT} d="m9.25 4 -5.5 5.5 5.5 5.5" />
  </>,
);

export const ExternalLink: Icon = /*#__PURE__*/ glyph(
  "ExternalLink",
  <>
    <path d="M10.5 5.25H6.25a2.5 2.5 0 0 0-2.5 2.5v10a2.5 2.5 0 0 0 2.5 2.5h10a2.5 2.5 0 0 0 2.5-2.5V13.5" />
    <path stroke={ACCENT} d="M13.5 3.75h6.75v6.75M20.25 3.75 11.75 12.25" />
  </>,
);

export const Refresh: Icon = /*#__PURE__*/ glyph(
  "Refresh",
  <>
    <path d="M20.25 11.25A8.25 8.25 0 0 0 5 9.25" />
    <path d="M4.5 5.25v4h4" />
    <path stroke={ACCENT} d="M3.75 12.75A8.25 8.25 0 0 0 19 14.75" />
    <path stroke={ACCENT} d="M19.5 18.75v-4h-4" />
  </>,
);

export const RotateCcw: Icon = /*#__PURE__*/ glyph(
  "RotateCcw",
  <>
    <path d="M3.75 11.25A8.25 8.25 0 0 1 19 9.25" />
    <path d="M19.5 5.25v4h-4" />
    <path stroke={ACCENT} d="M20.25 12.75A8.25 8.25 0 0 1 5 14.75" />
    <path stroke={ACCENT} d="M4.5 18.75v-4h4" />
  </>,
);

export const History: Icon = /*#__PURE__*/ glyph(
  "History",
  <>
    <path d="M4.05 12.75a7.95 7.95 0 1 0 2.3-5.6" />
    <path d="M3.75 8.5V13h4.5" />
    <path stroke={ACCENT} d="M12 7.75V12l3.25 1.9" />
  </>,
);

export const DotsThree: Icon = /*#__PURE__*/ glyph(
  "DotsThree",
  <>
    <circle fill={ACCENT} stroke="none" cx="5.5" cy="12" r="1.55" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="12" r="1.55" />
    <circle fill={ACCENT} stroke="none" cx="18.5" cy="12" r="1.55" />
  </>,
);

export const DotsThreeVertical: Icon = /*#__PURE__*/ glyph(
  "DotsThreeVertical",
  <>
    <circle fill={ACCENT} stroke="none" cx="12" cy="5.5" r="1.55" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="12" r="1.55" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="18.5" r="1.55" />
  </>,
);

export const DragHandle: Icon = /*#__PURE__*/ glyph(
  "DragHandle",
  <>
    <circle fill={ACCENT} stroke="none" cx="9" cy="6" r="1.5" />
    <circle fill={ACCENT} stroke="none" cx="15" cy="6" r="1.5" />
    <circle fill={ACCENT} stroke="none" cx="9" cy="12" r="1.5" />
    <circle fill={ACCENT} stroke="none" cx="15" cy="12" r="1.5" />
    <circle fill={ACCENT} stroke="none" cx="9" cy="18" r="1.5" />
    <circle fill={ACCENT} stroke="none" cx="15" cy="18" r="1.5" />
  </>,
);

export const Minus: Icon = /*#__PURE__*/ glyph(
  "Minus",
  <>
    <path stroke={ACCENT} d="M5 12h14" />
  </>,
);

export const ArrowsLeftRight: Icon = /*#__PURE__*/ glyph(
  "ArrowsLeftRight",
  <>
    <path d="M3.5 12h17" />
    <path stroke={ACCENT} d="m7.75 7.75-4 4.25 4 4.25M16.25 7.75l4 4.25-4 4.25" />
  </>,
);

export const ArrowsDownUp: Icon = /*#__PURE__*/ glyph(
  "ArrowsDownUp",
  <>
    <path d="M7.5 3.75v16.5" />
    <path d="m3.5 16.25 4 4 4-4" />
    <path stroke={ACCENT} d="M16.5 20.25V3.75" />
    <path stroke={ACCENT} d="m12.5 7.75 4-4 4 4" />
  </>,
);

export const ArrowsIn: Icon = /*#__PURE__*/ glyph(
  "ArrowsIn",
  <>
    <path d="m3.9 3.9 5.35 5.35M20.1 20.1l-5.35-5.35" />
    <path stroke={ACCENT} d="M9.25 4.5v4.75H4.5M14.75 19.5v-4.75h4.75" />
  </>,
);

export const ArrowsOut: Icon = /*#__PURE__*/ glyph(
  "ArrowsOut",
  <>
    <path d="m3.9 20.1 5.35-5.35M20.1 3.9l-5.35 5.35" />
    <path stroke={ACCENT} d="M9.25 19.5H4.5v-4.75M14.75 4.5h4.75v4.75" />
  </>,
);

export const Shuffle: Icon = /*#__PURE__*/ glyph(
  "Shuffle",
  <>
    <path d="M3.5 7.5h2.75a4 4 0 0 1 3.3 1.75l3.4 5a4 4 0 0 0 3.3 1.75h3.25" />
    <path d="M3.5 16.5h2.75a4 4 0 0 0 3.3-1.75" />
    <path d="M13.7 9.6a4 4 0 0 1 2.55-2.1" />
    <path stroke={ACCENT} d="m17.25 4.5 3.25 3-3.25 3M17.25 13.5l3.25 3-3.25 3" />
  </>,
);

export const Command: Icon = /*#__PURE__*/ glyph(
  "Command",
  <>
    <rect x="8.75" y="8.75" width="6.5" height="6.5" rx="1.25" />
    <path stroke={ACCENT} d="M8.75 8.75H6.5a2.75 2.75 0 1 1 2.75-2.75v2.75ZM15.25 8.75h2.25a2.75 2.75 0 1 0-2.75-2.75v2.75ZM8.75 15.25H6.5a2.75 2.75 0 1 0 2.75 2.75v-2.75ZM15.25 15.25h2.25a2.75 2.75 0 1 1-2.75 2.75v-2.75Z" />
  </>,
);

export const ListNumbers: Icon = /*#__PURE__*/ glyph(
  "ListNumbers",
  <>
    <path d="M9.75 6.5h10.75M9.75 12h10.75M9.75 17.5h10.75" />
    <path stroke={ACCENT} d="M3.75 5.4 5.4 4.5v4.4M3.5 14.9a1.65 1.65 0 1 1 2.85 1.4L3.5 19.5h3.1" />
  </>,
);

export const Plus: Icon = /*#__PURE__*/ glyph(
  "Plus",
  <>
    <path stroke={ACCENT} d="M12 4.75v14.5M4.75 12h14.5" />
  </>,
);

export const Copy: Icon = /*#__PURE__*/ glyph(
  "Copy",
  <>
    <path d="M5.5 15.9a2.5 2.5 0 0 1-1.75-2.4V6.25a2.5 2.5 0 0 1 2.5-2.5h7.25a2.5 2.5 0 0 1 2.4 1.8" />
    <rect stroke={ACCENT} x="8.25" y="8.25" width="12" height="12" rx="2.75" />
  </>,
);

export const Save: Icon = /*#__PURE__*/ glyph(
  "Save",
  <>
    <path d="M4.75 6.25a2.5 2.5 0 0 1 2.5-2.5h8.4l3.6 3.6v10.4a2.5 2.5 0 0 1-2.5 2.5H7.25a2.5 2.5 0 0 1-2.5-2.5V6.25Z" />
    <path stroke={ACCENT} d="M8.25 3.75v4.5h6.25v-4.5" />
    <path stroke={ACCENT} d="M8.25 20.25v-5.5h7.5v5.5" />
  </>,
);

export const EyeSlash: Icon = /*#__PURE__*/ glyph(
  "EyeSlash",
  <>
    <path d="M9.85 5.55A9.6 9.6 0 0 1 12 5.25c6 0 9.75 6.75 9.75 6.75a17.7 17.7 0 0 1-2.95 3.9M6.35 7.4A17.5 17.5 0 0 0 2.25 12S6 18.75 12 18.75a9.7 9.7 0 0 0 3.7-.72" />
    <path d="M9.85 9.9a3.25 3.25 0 0 0 4.3 4.3" />
    <path stroke={ACCENT} d="m3.75 3.75 16.5 16.5" />
  </>,
);

export const Archive: Icon = /*#__PURE__*/ glyph(
  "Archive",
  <>
    <rect x="3.25" y="3.75" width="17.5" height="4.5" rx="1.5" />
    <path d="M5.1 8.25v9.5a2.5 2.5 0 0 0 2.5 2.5h8.8a2.5 2.5 0 0 0 2.5-2.5v-9.5" />
    <path stroke={ACCENT} d="M9.75 12.25h4.5" />
  </>,
);

export const Cursor: Icon = /*#__PURE__*/ glyph(
  "Cursor",
  <>
    <path stroke={ACCENT} d="m5.25 3.5 5.5 16.25 2.6-6.35 6.4-2.6L5.25 3.5Z" />
  </>,
);

export const CursorClick: Icon = /*#__PURE__*/ glyph(
  "CursorClick",
  <>
    <path d="m9.4 8.4 3.9 11.5 1.85-4.5 4.5-1.85L9.4 8.4Z" />
    <path stroke={ACCENT} d="M5.9 5.9 4.25 4.25M12 4.6V2.75M4.6 12H2.75M6 18l-1.75 1.75M18.1 5.9l1.65-1.65" />
  </>,
);

export const Stack: Icon = /*#__PURE__*/ glyph(
  "Stack",
  <>
    <path stroke={ACCENT} d="m12 3.25 8.75 4.5L12 12.25 3.25 7.75 12 3.25Z" />
    <path d="m3.25 12 8.75 4.5 8.75-4.5M3.25 16.25 12 20.75l8.75-4.5" />
  </>,
);

export const Kanban: Icon = /*#__PURE__*/ glyph(
  "Kanban",
  <>
    <rect x="3.25" y="3.75" width="17.5" height="16.5" rx="2.75" />
    <rect stroke={ACCENT} x="6.5" y="7" width="3.75" height="9.75" rx="1.25" />
    <rect stroke={ACCENT} x="13.75" y="7" width="3.75" height="6" rx="1.25" />
  </>,
);

export const Queue: Icon = /*#__PURE__*/ glyph(
  "Queue",
  <>
    <path d="M3.75 6.5h11.5M3.75 11h11.5M3.75 15.5h7" />
    <path stroke={ACCENT} d="m14.75 13.75 5.5 3.5-5.5 3.5v-7Z" />
  </>,
);

export const ClipboardText: Icon = /*#__PURE__*/ glyph(
  "ClipboardText",
  <>
    <path d="M9 4.25H7a2.25 2.25 0 0 0-2.25 2.25v11.75A2.25 2.25 0 0 0 7 20.5h10a2.25 2.25 0 0 0 2.25-2.25V6.5A2.25 2.25 0 0 0 17 4.25h-2" />
    <rect stroke={ACCENT} x="8.75" y="2.25" width="6.5" height="4" rx="1.5" />
    <path d="M8.5 11.5h7M8.5 15.5h4.5" />
  </>,
);

export const Buildings: Icon = /*#__PURE__*/ glyph(
  "Buildings",
  <>
    <path d="M2.5 20.75h19" />
    <path d="M4 20.75V9.9a1.5 1.5 0 0 1 1.5-1.5h5.25a1.5 1.5 0 0 1 1.5 1.5v10.85" />
    <path stroke={ACCENT} d="M12.25 20.75V5.25a1.5 1.5 0 0 1 1.5-1.5h4.75a1.5 1.5 0 0 1 1.5 1.5v15.5" />
    <path d="M6.5 12.25h3.25M6.5 16h3.25" />
    <path stroke={ACCENT} d="M15 7.5h2.5M15 11.5h2.5M15 15.5h2.5" />
  </>,
);

export const Tag: Icon = /*#__PURE__*/ glyph(
  "Tag",
  <>
    <path d="M3.75 5.25A1.5 1.5 0 0 1 5.25 3.75h5.9a2 2 0 0 1 1.42.59l7.1 7.1a2 2 0 0 1 0 2.83l-5.4 5.4a2 2 0 0 1-2.83 0l-7.1-7.1a2 2 0 0 1-.59-1.42V5.25Z" />
    <circle fill={ACCENT} stroke="none" cx="8.4" cy="8.4" r="1.7" />
  </>,
);

export const TagChevron: Icon = /*#__PURE__*/ glyph(
  "TagChevron",
  <>
    <path d="M3.75 6.5a2.5 2.5 0 0 1 2.5-2.5h8.15a2 2 0 0 1 1.6.8l3.75 5a2 2 0 0 1 0 2.4l-3.75 5a2 2 0 0 1-1.6.8H6.25a2.5 2.5 0 0 1-2.5-2.5V6.5Z" />
    <circle fill={ACCENT} stroke="none" cx="8.25" cy="12" r="1.7" />
  </>,
);

export const Globe: Icon = /*#__PURE__*/ glyph(
  "Globe",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <ellipse cx="12" cy="12" rx="4" ry="8.75" />
    <path stroke={ACCENT} d="M3.6 9.25h16.8M3.6 14.75h16.8" />
  </>,
);

export const Crown: Icon = /*#__PURE__*/ glyph(
  "Crown",
  <>
    <path stroke={ACCENT} d="m3.25 7.25 3.4 8.5h10.7l3.4-8.5-4.75 3.4L12 5l-4 5.65L3.25 7.25Z" />
    <path d="M6.75 19.25h10.5" />
  </>,
);

export const MapPin: Icon = /*#__PURE__*/ glyph(
  "MapPin",
  <>
    <path d="M12 21.25s7-6.1 7-11.25a7 7 0 1 0-14 0c0 5.15 7 11.25 7 11.25Z" />
    <circle stroke={ACCENT} cx="12" cy="10" r="2.75" />
  </>,
);

export const UserGear: Icon = /*#__PURE__*/ glyph(
  "UserGear",
  <>
    <circle cx="9.5" cy="7.75" r="3.75" />
    <path d="M2.75 19.9a6.75 6.75 0 0 1 9.6-6.1" />
    <circle stroke={ACCENT} cx="17.25" cy="17.25" r="2.6" />
    <path stroke={ACCENT} d="M17.25 13.35v1.05M17.25 20.1v1.05M13.35 17.25h1.05M20.1 17.25h1.05" />
  </>,
);

export const UserMinus: Icon = /*#__PURE__*/ glyph(
  "UserMinus",
  <>
    <circle cx="10" cy="8" r="3.9" />
    <path d="M3 20.5a7 7 0 0 1 14 0" />
    <path stroke={ACCENT} d="M16.5 7.75h5" />
  </>,
);

export const UserCheck: Icon = /*#__PURE__*/ glyph(
  "UserCheck",
  <>
    <circle cx="10" cy="8" r="3.9" />
    <path d="M3 20.5a7 7 0 0 1 14 0" />
    <path stroke={ACCENT} d="m16.25 8.1 1.75 1.75 3.5-4" />
  </>,
);

export const Star: Icon = /*#__PURE__*/ glyph(
  "Star",
  <>
    <path stroke={ACCENT} d="m12 3.5 2.65 5.55 6.1.83-4.45 4.25 1.1 6.02L12 17.3l-5.4 2.85 1.1-6.02L3.25 9.88l6.1-.83L12 3.5Z" />
  </>,
);

export const IdCard: Icon = /*#__PURE__*/ glyph(
  "IdCard",
  <>
    <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2.75" />
    <circle stroke={ACCENT} cx="8.75" cy="11" r="2.4" />
    <path stroke={ACCENT} d="M5.25 16.4a3.75 3.75 0 0 1 7 0" />
    <path d="M15.25 10h3.5M15.25 14h3.5" />
  </>,
);

export const Handshake: Icon = /*#__PURE__*/ glyph(
  "Handshake",
  <>
    <path d="M3.5 3.75 2.5 13.9l6.15 6.15a1.1 1.1 0 0 0 1.55-1.55" />
    <path d="M3.5 4.6h7.25" />
    <path d="M20.5 3.75l1 10.15h-1.9" />
    <path d="m11.15 17.1 1.9 1.9a1.1 1.1 0 0 0 1.55-1.55" />
    <path stroke={ACCENT} d="m14.05 14.2 2.4 2.4a1.1 1.1 0 0 0 1.55-1.55l-3.75-3.75a2.85 2.85 0 0 0-4.03 0l-.8.8a1.1 1.1 0 0 1-1.55-1.55l2.7-2.7a5.6 5.6 0 0 1 6.83-.84l.45.27a2 2 0 0 0 1.4.25" />
  </>,
);

export const Smiley: Icon = /*#__PURE__*/ glyph(
  "Smiley",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="9.1" cy="9.6" r="1.0" fill="currentColor" stroke="none" /><circle cx="14.9" cy="9.6" r="1.0" fill="currentColor" stroke="none" />
    <path stroke={ACCENT} d="M8.25 14a4.5 4.5 0 0 0 7.5 0" />
  </>,
);

export const SmileyMeh: Icon = /*#__PURE__*/ glyph(
  "SmileyMeh",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="9.1" cy="9.6" r="1.0" fill="currentColor" stroke="none" /><circle cx="14.9" cy="9.6" r="1.0" fill="currentColor" stroke="none" />
    <path stroke={ACCENT} d="M8.5 15h7" />
  </>,
);

export const SmileySad: Icon = /*#__PURE__*/ glyph(
  "SmileySad",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="9.1" cy="9.6" r="1.0" fill="currentColor" stroke="none" /><circle cx="14.9" cy="9.6" r="1.0" fill="currentColor" stroke="none" />
    <path stroke={ACCENT} d="M8.25 15.75a4.5 4.5 0 0 1 7.5 0" />
  </>,
);

export const SmileyWink: Icon = /*#__PURE__*/ glyph(
  "SmileyWink",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <circle cx="9.1" cy="9.6" r="1.0" fill="currentColor" stroke="none" />
    <path d="M13.75 9.6h2.4" />
    <path stroke={ACCENT} d="M8.25 14a4.5 4.5 0 0 0 7.5 0" />
  </>,
);

export const Bookmark: Icon = /*#__PURE__*/ glyph(
  "Bookmark",
  <>
    <path stroke={ACCENT} d="M6.25 3.75h11.5a1 1 0 0 1 1 1v15.5L12 16.25l-6.75 4V4.75a1 1 0 0 1 1-1Z" />
  </>,
);

export const Heart: Icon = /*#__PURE__*/ glyph(
  "Heart",
  <>
    <path stroke={ACCENT} d="M12 20.5S3.25 15 3.25 9.25a4.75 4.75 0 0 1 8.75-2.6 4.75 4.75 0 0 1 8.75 2.6C20.75 15 12 20.5 12 20.5Z" />
  </>,
);

export const ThumbsUp: Icon = /*#__PURE__*/ glyph(
  "ThumbsUp",
  <>
    <path d="M7.75 20.25V10.5h2.4l2.85-6.1a2.2 2.2 0 0 1 3.05 2.85L14.9 10.5h4a2 2 0 0 1 1.95 2.45l-1.3 5.75a2 2 0 0 1-1.95 1.55H7.75Z" />
    <rect stroke={ACCENT} x="2.75" y="10.5" width="5" height="9.75" rx="1.6" />
  </>,
);

export const ThumbsDown: Icon = /*#__PURE__*/ glyph(
  "ThumbsDown",
  <>
    <path d="M7.75 3.75v9.75h2.4l2.85 6.1a2.2 2.2 0 0 0 3.05-2.85l-1.15-3.25h4a2 2 0 0 0 1.95-2.45L19.55 5.3a2 2 0 0 0-1.95-1.55H7.75Z" />
    <rect stroke={ACCENT} x="2.75" y="3.75" width="5" height="9.75" rx="1.6" />
  </>,
);

export const Storefront: Icon = /*#__PURE__*/ glyph(
  "Storefront",
  <>
    <path d="M4.5 10.4v8.35a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V10.4" />
    <path stroke={ACCENT} d="M2.75 9.75 4.7 4.25h14.6l1.95 5.5a3.05 3.05 0 0 1-5.75.6 3.05 3.05 0 0 1-6.1 0 3.05 3.05 0 0 1-5.75-.6Z" />
    <path d="M9.75 20.25v-5.5h4.5v5.5" />
  </>,
);

export const Whatsapp: Icon = /*#__PURE__*/ glyph(
  "Whatsapp",
  <>
    <path d="M3.5 20.5 5 16.1a8.25 8.25 0 1 1 3.1 3l-4.6 1.4Z" />
    <path stroke={ACCENT} d="M9.15 9.05c-.3 1.95 2.35 5.15 4.65 5.65.95.2 1.55-.45 1.85-1.05l-2.05-1-.9.9a5.7 5.7 0 0 1-2.35-2.45l.9-.9-1-2.05c-.6.25-1 .5-1.1.9Z" />
  </>,
);

export const Phone: Icon = /*#__PURE__*/ glyph(
  "Phone",
  <>
    <path stroke={ACCENT} d="M8.1 4.25H5.6A2.1 2.1 0 0 0 3.5 6.5c.35 5.75 5.65 11.05 11.4 11.4a2.1 2.1 0 0 0 2.25-2.1v-2.5l-4-1.6-1.85 1.85a12.1 12.1 0 0 1-3.35-3.35L9.8 8.35l-1.7-4.1Z" />
  </>,
);

export const PhoneCall: Icon = /*#__PURE__*/ glyph(
  "PhoneCall",
  <>
    <path d="M8.1 4.25H5.6A2.1 2.1 0 0 0 3.5 6.5c.35 5.75 5.65 11.05 11.4 11.4a2.1 2.1 0 0 0 2.25-2.1v-2.5l-4-1.6-1.85 1.85a12.1 12.1 0 0 1-3.35-3.35L9.8 8.35l-1.7-4.1Z" />
    <path stroke={ACCENT} d="M15.25 3.5a5.5 5.5 0 0 1 5.25 5.25M14.9 7.4a2.5 2.5 0 0 1 1.95 1.95" />
  </>,
);

export const PhoneIncoming: Icon = /*#__PURE__*/ glyph(
  "PhoneIncoming",
  <>
    <path d="M8.1 4.25H5.6A2.1 2.1 0 0 0 3.5 6.5c.35 5.75 5.65 11.05 11.4 11.4a2.1 2.1 0 0 0 2.25-2.1v-2.5l-4-1.6-1.85 1.85a12.1 12.1 0 0 1-3.35-3.35L9.8 8.35l-1.7-4.1Z" />
    <path stroke={ACCENT} d="M21 3.25 15.75 8.5M15.75 4v4.5h4.5" />
  </>,
);

export const PhoneOutgoing: Icon = /*#__PURE__*/ glyph(
  "PhoneOutgoing",
  <>
    <path d="M8.1 4.25H5.6A2.1 2.1 0 0 0 3.5 6.5c.35 5.75 5.65 11.05 11.4 11.4a2.1 2.1 0 0 0 2.25-2.1v-2.5l-4-1.6-1.85 1.85a12.1 12.1 0 0 1-3.35-3.35L9.8 8.35l-1.7-4.1Z" />
    <path stroke={ACCENT} d="m15.75 8.5 5.25-5.25M20.5 7.75v-4.5H16" />
  </>,
);

export const PhoneDisconnect: Icon = /*#__PURE__*/ glyph(
  "PhoneDisconnect",
  <>
    <path d="M8.1 4.25H5.6A2.1 2.1 0 0 0 3.5 6.5c.35 5.75 5.65 11.05 11.4 11.4a2.1 2.1 0 0 0 2.25-2.1v-2.5l-4-1.6-1.85 1.85a12.1 12.1 0 0 1-3.35-3.35L9.8 8.35l-1.7-4.1Z" />
    <path stroke={ACCENT} d="m3.75 20.25 16.5-16.5" />
  </>,
);

export const Envelope: Icon = /*#__PURE__*/ glyph(
  "Envelope",
  <>
    <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="2.75" />
    <path stroke={ACCENT} d="m3.6 7.1 7.25 5.25a2 2 0 0 0 2.3 0L20.4 7.1" />
  </>,
);

export const PaperPlane: Icon = /*#__PURE__*/ glyph(
  "PaperPlane",
  <>
    <path d="M20.9 3.1 3.4 9.35l7.4 3.85 3.85 7.4L20.9 3.1Z" />
    <path stroke={ACCENT} d="M20.9 3.1 10.8 13.2" />
  </>,
);

export const ChatText: Icon = /*#__PURE__*/ glyph(
  "ChatText",
  <>
    <path d="M7 4h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3l-4.5 3.9a.6.6 0 0 1-1-.45V16H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" />
    <path stroke={ACCENT} d="M8 8.5h8M8 11.75h5" />
  </>,
);

export const Chats: Icon = /*#__PURE__*/ glyph(
  "Chats",
  <>
    <path d="M8.5 15.25H6a2.5 2.5 0 0 1-2.5-2.5V6a2.5 2.5 0 0 1 2.5-2.5h8a2.5 2.5 0 0 1 2.5 2.5v1" />
    <path stroke={ACCENT} d="M18 8.75a2.5 2.5 0 0 1 2.5 2.5v6.75a2.5 2.5 0 0 1-2.5 2.5h-2.25l-3.6 2.4v-2.4H10a2.5 2.5 0 0 1-2.5-2.5v-6.75a2.5 2.5 0 0 1 2.5-2.5h8Z" />
  </>,
);

export const Microphone: Icon = /*#__PURE__*/ glyph(
  "Microphone",
  <>
    <rect stroke={ACCENT} x="9" y="2.75" width="6" height="11" rx="3" />
    <path d="M5.5 11.25a6.5 6.5 0 0 0 13 0M12 17.75v3.5M8.75 21.25h6.5" />
  </>,
);

export const DeviceMobile: Icon = /*#__PURE__*/ glyph(
  "DeviceMobile",
  <>
    <rect x="6.75" y="2.75" width="10.5" height="18.5" rx="2.75" />
    <path stroke={ACCENT} d="M10.5 18.25h3" />
  </>,
);

export const SpeakerHigh: Icon = /*#__PURE__*/ glyph(
  "SpeakerHigh",
  <>
    <path d="M3.75 9.5h3l4.5-3.75v12.5L6.75 14.5h-3V9.5Z" />
    <path stroke={ACCENT} d="M15.25 9.25a4 4 0 0 1 0 5.5M18 6.75a7.75 7.75 0 0 1 0 10.5" />
  </>,
);

export const Waveform: Icon = /*#__PURE__*/ glyph(
  "Waveform",
  <>
    <path d="M3.5 10.4v3.2M9.17 6.4v11.2M14.83 6.4v11.2M20.5 10.4v3.2" />
    <path stroke={ACCENT} d="M6.33 8.4v7.2M12 4.4v15.2M17.67 8.4v7.2" />
  </>,
);

export const WaveSquare: Icon = /*#__PURE__*/ glyph(
  "WaveSquare",
  <>
    <path stroke={ACCENT} d="M3.5 16.5h3.25v-9h5v9h5v-9h3.75" />
  </>,
);

export const Megaphone: Icon = /*#__PURE__*/ glyph(
  "Megaphone",
  <>
    <path d="M3.75 9.5 15.25 5v14L3.75 14.5v-5Z" />
    <path d="M3.75 9.5h-.5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h.5" />
    <path d="M7 15.4v3.35a1.5 1.5 0 0 0 3 0v-2.2" />
    <path stroke={ACCENT} d="M18.25 8.75a4.25 4.25 0 0 1 0 6.5" />
  </>,
);

export const Broadcast: Icon = /*#__PURE__*/ glyph(
  "Broadcast",
  <>
    <circle fill={ACCENT} stroke="none" cx="12" cy="12" r="2.2" />
    <path d="M7.6 7.6a6.25 6.25 0 0 0 0 8.8M16.4 16.4a6.25 6.25 0 0 0 0-8.8" />
    <path stroke={ACCENT} d="M4.4 4.4a10.75 10.75 0 0 0 0 15.2M19.6 19.6a10.75 10.75 0 0 0 0-15.2" />
  </>,
);

export const BellSlash: Icon = /*#__PURE__*/ glyph(
  "BellSlash",
  <>
    <path d="M6.4 9.1a6 6 0 0 1 11.6 2.15c0 3.5 1 5.35 1.7 6.25H8.25M4.2 16.65A9.4 9.4 0 0 0 6 11.25" />
    <path d="M13.9 20.5a2.2 2.2 0 0 1-3.8 0" />
    <path stroke={ACCENT} d="m3.75 3.75 16.5 16.5" />
  </>,
);

export const Telegram: Icon = /*#__PURE__*/ glyph(
  "Telegram",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path d="m6.5 12.1 11-4.35-2.35 9.6-3.35-2.6-1.9 1.85-.4-3.05L6.5 12.1Z" />
    <path stroke={ACCENT} d="m17.5 7.75-7.6 5.55" />
  </>,
);

export const Instagram: Icon = /*#__PURE__*/ glyph(
  "Instagram",
  <>
    <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" />
    <circle stroke={ACCENT} cx="12" cy="12" r="4.25" />
    <circle fill={ACCENT} stroke="none" cx="16.85" cy="7.15" r="1.2" />
  </>,
);

export const Google: Icon = /*#__PURE__*/ glyph(
  "Google",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M16.4 8.85A5.25 5.25 0 1 0 17.25 12H12" />
  </>,
);

export const Webhooks: Icon = /*#__PURE__*/ glyph(
  "Webhooks",
  <>
    <circle cx="6.75" cy="17.25" r="3.25" />
    <circle cx="17.25" cy="17.25" r="3.25" />
    <circle stroke={ACCENT} cx="12" cy="6.5" r="3.25" />
    <path stroke={ACCENT} d="M10.15 9.15 8.2 14.15M13.85 9.15l1.95 5M10.05 17.25h3.9" />
  </>,
);

export const Image: Icon = /*#__PURE__*/ glyph(
  "Image",
  <>
    <rect x="3.25" y="3.75" width="17.5" height="16.5" rx="3" />
    <circle fill={ACCENT} stroke="none" cx="8.6" cy="9.1" r="1.75" />
    <path d="m3.9 17.6 4.6-4.6a2 2 0 0 1 2.83 0l3.6 3.6" />
    <path d="m13 15.4 1.75-1.75a2 2 0 0 1 2.83 0l2.55 2.55" />
  </>,
);

export const ImageBroken: Icon = /*#__PURE__*/ glyph(
  "ImageBroken",
  <>
    <path d="M3.25 9V6.75a3 3 0 0 1 3-3H9M15 3.75h2.75a3 3 0 0 1 3 3V9M20.75 15v2.25a3 3 0 0 1-3 3H15M9 20.25H6.25a3 3 0 0 1-3-3V15" />
    <path stroke={ACCENT} d="M7.5 14.75 10 12l2.25 2.25L15 11l1.75 1.75" />
  </>,
);

export const Camera: Icon = /*#__PURE__*/ glyph(
  "Camera",
  <>
    <path d="M3.25 9a2.5 2.5 0 0 1 2.5-2.5h1.4a2 2 0 0 0 1.7-.95l.6-1a2 2 0 0 1 1.7-.95h1.7a2 2 0 0 1 1.7.95l.6 1a2 2 0 0 0 1.7.95h1.4a2.5 2.5 0 0 1 2.5 2.5v8.25a2.5 2.5 0 0 1-2.5 2.5H5.75a2.5 2.5 0 0 1-2.5-2.5V9Z" />
    <circle stroke={ACCENT} cx="12" cy="13" r="3.75" />
  </>,
);

export const VideoCamera: Icon = /*#__PURE__*/ glyph(
  "VideoCamera",
  <>
    <rect x="2.75" y="6.25" width="13" height="11.5" rx="2.75" />
    <path stroke={ACCENT} d="m15.75 10.5 4.15-2.4a1 1 0 0 1 1.5.87v6.06a1 1 0 0 1-1.5.87l-4.15-2.4v-3Z" />
  </>,
);

export const Play: Icon = /*#__PURE__*/ glyph(
  "Play",
  <>
    <path stroke={ACCENT} d="M6.75 4.6a1 1 0 0 1 1.52-.85l11.3 7.4a1 1 0 0 1 0 1.7l-11.3 7.4a1 1 0 0 1-1.52-.85V4.6Z" />
  </>,
);

export const PlayCircle: Icon = /*#__PURE__*/ glyph(
  "PlayCircle",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M10.15 8.5a.75.75 0 0 1 1.14-.64l5.5 3.5a.75.75 0 0 1 0 1.28l-5.5 3.5a.75.75 0 0 1-1.14-.64V8.5Z" />
  </>,
);

export const Pause: Icon = /*#__PURE__*/ glyph(
  "Pause",
  <>
    <rect stroke={ACCENT} x="6.75" y="4.25" width="4" height="15.5" rx="1.5" />
    <rect stroke={ACCENT} x="13.25" y="4.25" width="4" height="15.5" rx="1.5" />
  </>,
);

export const PauseCircle: Icon = /*#__PURE__*/ glyph(
  "PauseCircle",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M10.25 8.75v6.5M13.75 8.75v6.5" />
  </>,
);

export const Stop: Icon = /*#__PURE__*/ glyph(
  "Stop",
  <>
    <rect stroke={ACCENT} x="4.75" y="4.75" width="14.5" height="14.5" rx="3" />
  </>,
);

export const StopCircle: Icon = /*#__PURE__*/ glyph(
  "StopCircle",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <rect stroke={ACCENT} x="9" y="9" width="6" height="6" rx="1.5" />
  </>,
);

export const Files: Icon = /*#__PURE__*/ glyph(
  "Files",
  <>
    <path d="M8.75 6.5V4.75a1.5 1.5 0 0 1 1.5-1.5h4.5l4 4v8a1.5 1.5 0 0 1-1.5 1.5h-1.75" />
    <path stroke={ACCENT} d="M5.25 8.25h5.25l4 4v7.5a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5V9.75a1.5 1.5 0 0 1 1.5-1.5Z" />
  </>,
);

export const FileCsv: Icon = /*#__PURE__*/ glyph(
  "FileCsv",
  <>
    <path d="M13.75 3.25H7.5A2.25 2.25 0 0 0 5.25 5.5v13a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25V8.25l-5-5Z" />
    <path d="M13.75 3.25v3.5a1.5 1.5 0 0 0 1.5 1.5h3.5" />
    <path stroke={ACCENT} d="M8.5 12.75h7M8.5 16.5h7M12 12.75v3.75" />
  </>,
);

export const FilmStrip: Icon = /*#__PURE__*/ glyph(
  "FilmStrip",
  <>
    <rect x="2.75" y="4.75" width="18.5" height="14.5" rx="2.5" />
    <path stroke={ACCENT} d="M7.25 4.75v14.5M16.75 4.75v14.5" />
    <path d="M2.75 9.5h4.5M2.75 14.5h4.5M16.75 9.5h4.5M16.75 14.5h4.5" />
  </>,
);

export const FilmSlate: Icon = /*#__PURE__*/ glyph(
  "FilmSlate",
  <>
    <path d="M3.25 10h17.5v8.25a2.5 2.5 0 0 1-2.5 2.5H5.75a2.5 2.5 0 0 1-2.5-2.5V10Z" />
    <path stroke={ACCENT} d="m3.4 10 .95-3.8 16.4 2.2-.4 1.6H3.4Z" />
    <path stroke={ACCENT} d="M8.5 6.75 6.9 10M13.6 7.4 12 10M18.4 8.05 17 10" />
  </>,
);

export const Monitor: Icon = /*#__PURE__*/ glyph(
  "Monitor",
  <>
    <rect x="2.75" y="3.75" width="18.5" height="13" rx="2.5" />
    <path stroke={ACCENT} d="M8.5 20.25h7M12 16.75v3.5" />
  </>,
);

export const MonitorPlay: Icon = /*#__PURE__*/ glyph(
  "MonitorPlay",
  <>
    <rect x="2.75" y="3.75" width="18.5" height="13" rx="2.5" />
    <path d="M8.5 20.25h7M12 16.75v3.5" />
    <path stroke={ACCENT} d="M10.4 7.6a.6.6 0 0 1 .92-.5l3.6 2.4a.6.6 0 0 1 0 1l-3.6 2.4a.6.6 0 0 1-.92-.5V7.6Z" />
  </>,
);

export const Gif: Icon = /*#__PURE__*/ glyph(
  "Gif",
  <>
    <rect x="2.75" y="5.25" width="18.5" height="13.5" rx="3" />
    <path stroke={ACCENT} d="M9.5 10.75a2.6 2.6 0 1 0 0 2.75v-.9h-1.4M12.75 9.5v5M15.75 14.5v-5h3M15.75 12h2.25" />
  </>,
);

export const Paperclip: Icon = /*#__PURE__*/ glyph(
  "Paperclip",
  <>
    <path stroke={ACCENT} d="M20.25 11.5 12.4 19.35a5 5 0 0 1-7.07-7.07l8.2-8.2a3.33 3.33 0 0 1 4.71 4.71l-8.2 8.2a1.67 1.67 0 0 1-2.36-2.36l7.5-7.49" />
  </>,
);

export const TreeStructure: Icon = /*#__PURE__*/ glyph(
  "TreeStructure",
  <>
    <rect x="2.75" y="9.75" width="5.5" height="4.5" rx="1.5" />
    <rect x="15.75" y="3.5" width="5.5" height="4.5" rx="1.5" />
    <rect x="15.75" y="16" width="5.5" height="4.5" rx="1.5" />
    <path stroke={ACCENT} d="M8.25 12h3.5V5.75h4M11.75 12v6.25h4" />
  </>,
);

export const ChartPie: Icon = /*#__PURE__*/ glyph(
  "ChartPie",
  <>
    <path d="M11.25 3.28a8.75 8.75 0 1 0 9.47 9.47" />
    <path stroke={ACCENT} d="M12 12V3.28a8.75 8.75 0 0 1 8.72 8.72H12Z" />
  </>,
);

export const ChartDonut: Icon = /*#__PURE__*/ glyph(
  "ChartDonut",
  <>
    <circle cx="12" cy="12" r="8.6" />
    <circle cx="12" cy="12" r="4.1" />
    <path stroke={ACCENT} d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6h-4.5A4.1 4.1 0 0 0 12 7.9V3.4Z" />
  </>,
);

export const ChartLine: Icon = /*#__PURE__*/ glyph(
  "ChartLine",
  <>
    <path d="M4 3.75v14.5a2 2 0 0 0 2 2h14.25" />
    <path stroke={ACCENT} d="m7.5 15.75 3.5-4.25 3 2.75 4.5-6" />
  </>,
);

export const TrendUp: Icon = /*#__PURE__*/ glyph(
  "TrendUp",
  <>
    <path d="M3.75 20.5h16.5" />
    <path stroke={ACCENT} d="m3.75 16.25 5.5-5.5 3.5 3.5 6.75-6.75" />
    <path stroke={ACCENT} d="M14.25 7.5h5.25v5.25" />
  </>,
);

export const Scales: Icon = /*#__PURE__*/ glyph(
  "Scales",
  <>
    <path d="M12 6.5v13.75M7.75 20.25h8.5" />
    <circle cx="12" cy="5" r="1.65" />
    <path d="M5.5 7.75h13" />
    <path stroke={ACCENT} d="M5.5 7.75 3 13.4a3.4 3.4 0 0 0 5 0L5.5 7.75ZM18.5 7.75 16 13.4a3.4 3.4 0 0 0 5 0l-2.5-5.65Z" />
  </>,
);

export const Database: Icon = /*#__PURE__*/ glyph(
  "Database",
  <>
    <ellipse cx="12" cy="6.25" rx="7.75" ry="3" />
    <path d="M4.25 6.25v11.5c0 1.66 3.47 3 7.75 3s7.75-1.34 7.75-3V6.25" />
    <path stroke={ACCENT} d="M4.25 12c0 1.66 3.47 3 7.75 3s7.75-1.34 7.75-3" />
  </>,
);

export const Table: Icon = /*#__PURE__*/ glyph(
  "Table",
  <>
    <rect x="3.25" y="4.25" width="17.5" height="15.5" rx="2.5" />
    <path stroke={ACCENT} d="M3.25 9.5h17.5" />
    <path d="M3.25 14.75h17.5M9.75 9.5v10.25M15.5 9.5v10.25" />
  </>,
);

export const Calculator: Icon = /*#__PURE__*/ glyph(
  "Calculator",
  <>
    <rect x="4.25" y="2.75" width="15.5" height="18.5" rx="2.75" />
    <rect stroke={ACCENT} x="7.75" y="6" width="8.5" height="3.5" rx="1.15" />
    <circle cx="8.5" cy="13" r="1.0" fill="currentColor" stroke="none" /><circle cx="12" cy="13" r="1.0" fill="currentColor" stroke="none" /><circle cx="15.5" cy="13" r="1.0" fill="currentColor" stroke="none" /><circle cx="8.5" cy="17" r="1.0" fill="currentColor" stroke="none" /><circle cx="12" cy="17" r="1.0" fill="currentColor" stroke="none" /><circle cx="15.5" cy="17" r="1.0" fill="currentColor" stroke="none" />
  </>,
);

export const Thermometer: Icon = /*#__PURE__*/ glyph(
  "Thermometer",
  <>
    <path d="M14.25 14.4V5.5a2.25 2.25 0 0 0-4.5 0v8.9a4.25 4.25 0 1 0 4.5 0Z" />
    <path stroke={ACCENT} strokeWidth="2.2" d="M12 9.75v7.5" />
  </>,
);

export const Pulse: Icon = /*#__PURE__*/ glyph(
  "Pulse",
  <>
    <path stroke={ACCENT} d="M3.25 12h3.9l2.35-5.75 4.35 11.5L16.2 12h4.55" />
  </>,
);

export const Package: Icon = /*#__PURE__*/ glyph(
  "Package",
  <>
    <path d="m12 2.9 8.25 4.55v9.1L12 21.1 3.75 16.55v-9.1L12 2.9Z" />
    <path stroke={ACCENT} d="m3.9 7.4 8.1 4.5 8.1-4.5M12 21.1V11.9" />
  </>,
);

export const Wallet: Icon = /*#__PURE__*/ glyph(
  "Wallet",
  <>
    <path d="M3.75 7.75a2.5 2.5 0 0 1 2.5-2.5h11a2.5 2.5 0 0 1 2.5 2.5v9a2.5 2.5 0 0 1-2.5 2.5h-11a2.5 2.5 0 0 1-2.5-2.5v-9Z" />
    <path stroke={ACCENT} d="M20.25 10.25h-3.4a2 2 0 0 0 0 4h3.4" />
    <circle fill={ACCENT} stroke="none" cx="16.9" cy="12.25" r="1" />
  </>,
);

export const Receipt: Icon = /*#__PURE__*/ glyph(
  "Receipt",
  <>
    <path d="M4.75 3.75h14.5v17.5l-2.9-1.75-2.9 1.75-2.9-1.75-2.9 1.75-2.9-1.75Z" />
    <path stroke={ACCENT} d="M8.25 8.5h7.5M8.25 12.25h7.5M8.25 16h4.5" />
  </>,
);

export const Barcode: Icon = /*#__PURE__*/ glyph(
  "Barcode",
  <>
    <path d="M3.75 5.5v13M7 5.5v13M12.5 5.5v13M17.25 5.5v13M20.25 5.5v13" />
    <path stroke={ACCENT} d="M9.75 5.5v13M15 5.5v13" />
  </>,
);

export const Pix: Icon = /*#__PURE__*/ glyph(
  "Pix",
  <>
    <path stroke={ACCENT} d="m9.6 7.2 1.7-1.7a1 1 0 0 1 1.4 0l1.7 1.7" />
    <path stroke={ACCENT} d="m16.8 9.6 1.7 1.7a1 1 0 0 1 0 1.4l-1.7 1.7" />
    <path stroke={ACCENT} d="m14.4 16.8-1.7 1.7a1 1 0 0 1-1.4 0l-1.7-1.7" />
    <path stroke={ACCENT} d="m7.2 14.4-1.7-1.7a1 1 0 0 1 0-1.4l1.7-1.7" />
  </>,
);

export const Certificate: Icon = /*#__PURE__*/ glyph(
  "Certificate",
  <>
    <rect x="3.25" y="3.75" width="17.5" height="11.5" rx="2.5" />
    <path d="M7 7.75h6.5M7 11.25h4" />
    <circle stroke={ACCENT} cx="16.5" cy="15.75" r="3.1" />
    <path stroke={ACCENT} d="m14.45 18.05-.7 3.2 2.75-1.45 2.75 1.45-.7-3.2" />
  </>,
);

export const Bank: Icon = /*#__PURE__*/ glyph(
  "Bank",
  <>
    <path d="M3.25 9.25 12 3.75l8.75 5.5" />
    <path d="M5.75 9.75v7.75M10 9.75v7.75M14 9.75v7.75M18.25 9.75v7.75" />
    <path stroke={ACCENT} d="M3.25 20.25h17.5" />
  </>,
);

export const Robot: Icon = /*#__PURE__*/ glyph(
  "Robot",
  <>
    <rect x="3.75" y="7.25" width="16.5" height="12.5" rx="3.25" />
    <path d="M12 4.25v3M1.75 12.5v2.5M22.25 12.5v2.5" />
    <circle cx="12" cy="3.25" r="1.35" />
    <circle fill={ACCENT} stroke="none" cx="8.75" cy="12.5" r="1.6" />
    <circle fill={ACCENT} stroke="none" cx="15.25" cy="12.5" r="1.6" />
    <path d="M9.5 16.25h5" />
  </>,
);

export const Brain: Icon = /*#__PURE__*/ glyph(
  "Brain",
  <>
    <path d="M12 5.1a3.2 3.2 0 0 0-5.95-1.1A2.9 2.9 0 0 0 3.7 8.2a3.1 3.1 0 0 0 .15 4.5 3 3 0 0 0 1.6 4.65A3.2 3.2 0 0 0 12 19.15V5.1Z" />
    <path stroke={ACCENT} d="M12 5.1a3.2 3.2 0 0 1 5.95-1.1A2.9 2.9 0 0 1 20.3 8.2a3.1 3.1 0 0 1-.15 4.5 3 3 0 0 1-1.6 4.65A3.2 3.2 0 0 1 12 19.15V5.1Z" />
  </>,
);

export const Sparkle: Icon = /*#__PURE__*/ glyph(
  "Sparkle",
  <>
    <path stroke={ACCENT} d="M10.5 2.75c1 5.15 2.6 6.75 7.75 7.75-5.15 1-6.75 2.6-7.75 7.75-1-5.15-2.6-6.75-7.75-7.75 5.15-1 6.75-2.6 7.75-7.75Z" />
    <path d="M18 15.25c.4 2.05 1.05 2.7 3.1 3.1-2.05.4-2.7 1.05-3.1 3.1-.4-2.05-1.05-2.7-3.1-3.1 2.05-.4 2.7-1.05 3.1-3.1Z" />
  </>,
);

export const Lightning: Icon = /*#__PURE__*/ glyph(
  "Lightning",
  <>
    <path stroke={ACCENT} d="M13.4 2.75 4.6 13.6h6.1l-.1 7.65 8.8-10.85h-6.1l.1-7.65Z" />
  </>,
);

export const Lightbulb: Icon = /*#__PURE__*/ glyph(
  "Lightbulb",
  <>
    <path d="M9 16.9a6.25 6.25 0 1 1 6 0v1.85a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5V16.9Z" />
    <path stroke={ACCENT} d="M9.75 21.25h4.5" />
  </>,
);

export const Wrench: Icon = /*#__PURE__*/ glyph(
  "Wrench",
  <>
    <path stroke={ACCENT} d="M20.1 6.35 17 9.45l-2.45-2.45 3.1-3.1a5.4 5.4 0 0 0-7.15 6.5l-6.2 6.2a2.25 2.25 0 0 0 3.2 3.2l6.2-6.2a5.4 5.4 0 0 0 6.4-7.25Z" />
  </>,
);

export const PuzzlePiece: Icon = /*#__PURE__*/ glyph(
  "PuzzlePiece",
  <>
    <path stroke={ACCENT} d="M10.4 3.75h3.2v1.4a2.15 2.15 0 1 0 4.3 0v-1.4h1.35a1.5 1.5 0 0 1 1.5 1.5V8.4h-1.4a2.15 2.15 0 1 0 0 4.3h1.4v3.15a1.5 1.5 0 0 1-1.5 1.5H16.1v1.4a2.15 2.15 0 1 1-4.3 0v-1.4H8.65a1.5 1.5 0 0 1-1.5-1.5V12.7h-1.4a2.15 2.15 0 1 1 0-4.3h1.4V5.25a1.5 1.5 0 0 1 1.5-1.5h1.75Z" />
  </>,
);

export const TestTube: Icon = /*#__PURE__*/ glyph(
  "TestTube",
  <>
    <path d="M8.75 2.75v13.4a3.75 3.75 0 0 0 7.5 0V2.75" />
    <path d="M7.25 2.75h10.5" />
    <path stroke={ACCENT} d="M8.75 12.5h7.5" />
  </>,
);

export const Code: Icon = /*#__PURE__*/ glyph(
  "Code",
  <>
    <path stroke={ACCENT} d="m8.5 8.5-4.75 3.5L8.5 15.5M15.5 8.5l4.75 3.5-4.75 3.5" />
    <path d="m13.75 4.5-3.5 15" />
  </>,
);

export const BracketsCurly: Icon = /*#__PURE__*/ glyph(
  "BracketsCurly",
  <>
    <path stroke={ACCENT} d="M9.25 3.75c-2 0-2.65 1-2.65 2.75v2.25c0 1.75-.85 2.5-2.6 3.25 1.75.75 2.6 1.5 2.6 3.25v2.25c0 1.75.65 2.75 2.65 2.75M14.75 3.75c2 0 2.65 1 2.65 2.75v2.25c0 1.75.85 2.5 2.6 3.25-1.75.75-2.6 1.5-2.6 3.25v2.25c0 1.75-.65 2.75-2.65 2.75" />
  </>,
);

export const BracketsAngle: Icon = /*#__PURE__*/ glyph(
  "BracketsAngle",
  <>
    <path stroke={ACCENT} d="M9.5 4.75 3.75 12l5.75 7.25M14.5 4.75 20.25 12l-5.75 7.25" />
  </>,
);

export const GitBranch: Icon = /*#__PURE__*/ glyph(
  "GitBranch",
  <>
    <circle cx="6.75" cy="5.5" r="2.75" />
    <circle cx="6.75" cy="18.5" r="2.75" />
    <circle stroke={ACCENT} cx="17.25" cy="5.5" r="2.75" />
    <path d="M6.75 8.25v7.5" />
    <path stroke={ACCENT} d="M17.25 8.25a6.5 6.5 0 0 1-6.5 6.5H9.4" />
  </>,
);

export const GitMerge: Icon = /*#__PURE__*/ glyph(
  "GitMerge",
  <>
    <circle cx="6.75" cy="5.5" r="2.75" />
    <circle cx="6.75" cy="18.5" r="2.75" />
    <circle stroke={ACCENT} cx="17.25" cy="12" r="2.75" />
    <path d="M6.75 8.25v7.5" />
    <path stroke={ACCENT} d="M14.5 12h-1.25a6.5 6.5 0 0 1-6.5-6.5" />
  </>,
);

export const FlowArrow: Icon = /*#__PURE__*/ glyph(
  "FlowArrow",
  <>
    <path d="M2.75 12h4.4a4 4 0 0 0 3.4-1.9l1.4-2.2a4 4 0 0 1 3.4-1.9h3.9" />
    <path d="M2.75 12h4.4a4 4 0 0 1 3.4 1.9l1.4 2.2a4 4 0 0 0 3.4 1.9h3.9" />
    <path stroke={ACCENT} d="m17.5 2.75 3.75 3.25-3.75 3.25M17.5 14.75 21.25 18l-3.75 3.25" />
  </>,
);

export const GraduationCap: Icon = /*#__PURE__*/ glyph(
  "GraduationCap",
  <>
    <path d="m2.75 8.5 9.25-4.5 9.25 4.5-9.25 4.5-9.25-4.5Z" />
    <path stroke={ACCENT} d="M6.5 10.35v5.4c0 1.8 2.46 3.25 5.5 3.25s5.5-1.45 5.5-3.25v-5.4" />
    <path d="M20.75 8.75v5.5" />
  </>,
);

export const Leaf: Icon = /*#__PURE__*/ glyph(
  "Leaf",
  <>
    <path stroke={ACCENT} d="M20.25 3.75c0 8.9-5.5 13.5-11.25 13.5a5.5 5.5 0 0 1-5.5-5.5c0-5.75 6.25-8 16.75-8Z" />
    <path d="M3.75 20.25c1.9-5.4 4.9-8.9 9.75-11.4" />
  </>,
);

export const Fire: Icon = /*#__PURE__*/ glyph(
  "Fire",
  <>
    <path stroke={ACCENT} d="M12 2.75S11 6.4 8.4 8.65C6 10.75 5 12.75 5 14.9a7 7 0 0 0 14 0c0-3.4-2.35-5.5-3.4-8.4-1.4 1.5-1.9 2.5-1.9 2.5S13.4 5.5 12 2.75Z" />
    <path d="M12 20.1a3.4 3.4 0 0 1-1.55-6.45c.8 1.4 1.55 1.95 1.55 1.95s.4-1.05 1-2.05c1.3 1 2.4 2.35 2.4 3.65A3.4 3.4 0 0 1 12 20.1Z" />
  </>,
);

export const Plug: Icon = /*#__PURE__*/ glyph(
  "Plug",
  <>
    <path d="M9 3.25v5M15 3.25v5" />
    <path stroke={ACCENT} d="M6.25 8.25h11.5v3.5a5.75 5.75 0 0 1-11.5 0v-3.5Z" />
    <path d="M12 17.5v3.25" />
  </>,
);

export const Plugs: Icon = /*#__PURE__*/ glyph(
  "Plugs",
  <>
    <path stroke={ACCENT} d="M12 8.25H8.25a3.75 3.75 0 0 0 0 7.5H12v-7.5Z" />
    <path d="M12 10.5h3.5M12 13.5h3.5" />
    <path d="M15.5 7.5h.9a4.25 4.25 0 0 1 0 8.5h-.9v-8.5Z" />
  </>,
);

export const Subset: Icon = /*#__PURE__*/ glyph(
  "Subset",
  <>
    <path d="M17.75 5.75h-5.25a6.25 6.25 0 0 0 0 12.5h5.25" />
    <path stroke={ACCENT} d="M11.25 21h6.5" />
  </>,
);

export const Clock: Icon = /*#__PURE__*/ glyph(
  "Clock",
  <>
    <circle cx="12" cy="12" r="8.75" />
    <path stroke={ACCENT} d="M12 6.75V12l3.5 2" />
  </>,
);

export const CalendarCheck: Icon = /*#__PURE__*/ glyph(
  "CalendarCheck",
  <>
    <rect x="3.25" y="5" width="17.5" height="15.75" rx="2.75" />
    <path d="M8 3.25v3.5M16 3.25v3.5M3.25 10h17.5" />
    <path stroke={ACCENT} d="m8.75 15.25 2.25 2.25 4.25-4.75" />
  </>,
);

export const Lock: Icon = /*#__PURE__*/ glyph(
  "Lock",
  <>
    <rect x="4.25" y="10" width="15.5" height="10.75" rx="2.75" />
    <path stroke={ACCENT} d="M7.75 10V7.5a4.25 4.25 0 0 1 8.5 0V10" />
    <circle cx="12" cy="15.4" r="1.4" />
  </>,
);

export const LockKey: Icon = /*#__PURE__*/ glyph(
  "LockKey",
  <>
    <rect x="4.25" y="10" width="15.5" height="10.75" rx="2.75" />
    <path d="M7.75 10V7.5a4.25 4.25 0 0 1 8.5 0V10" />
    <circle stroke={ACCENT} cx="12" cy="14.25" r="1.5" />
    <path stroke={ACCENT} d="M12 15.75v2.5" />
  </>,
);

export const Key: Icon = /*#__PURE__*/ glyph(
  "Key",
  <>
    <circle cx="8" cy="8" r="4.25" />
    <path stroke={ACCENT} d="m11.05 11.05 9.2 9.2M16.75 17.5l1.9-1.9M14 14.75l1.9-1.9" />
  </>,
);

export const Shield: Icon = /*#__PURE__*/ glyph(
  "Shield",
  <>
    <path stroke={ACCENT} d="M12 21.25s7.25-3.25 7.25-9.25V5.9L12 3.15 4.75 5.9v6.1c0 6 7.25 9.25 7.25 9.25Z" />
  </>,
);

export const ShieldCheck: Icon = /*#__PURE__*/ glyph(
  "ShieldCheck",
  <>
    <path d="M12 21.25s7.25-3.25 7.25-9.25V5.9L12 3.15 4.75 5.9v6.1c0 6 7.25 9.25 7.25 9.25Z" />
    <path stroke={ACCENT} d="m8.9 11.9 2.35 2.35 4.1-4.6" />
  </>,
);

export const ShieldPlus: Icon = /*#__PURE__*/ glyph(
  "ShieldPlus",
  <>
    <path d="M12 21.25s7.25-3.25 7.25-9.25V5.9L12 3.15 4.75 5.9v6.1c0 6 7.25 9.25 7.25 9.25Z" />
    <path stroke={ACCENT} d="M12 8.5v6M9 11.5h6" />
  </>,
);

export const Link: Icon = /*#__PURE__*/ glyph(
  "Link",
  <>
    <path d="M13.75 10.25a4.6 4.6 0 0 0-6.65-.35L4.6 12.4a4.6 4.6 0 0 0 6.5 6.5l1.4-1.4" />
    <path stroke={ACCENT} d="M10.25 13.75a4.6 4.6 0 0 0 6.65.35l2.5-2.5a4.6 4.6 0 0 0-6.5-6.5l-1.4 1.4" />
  </>,
);

export const LinkBreak: Icon = /*#__PURE__*/ glyph(
  "LinkBreak",
  <>
    <path d="M9.75 14.25 8 16a3.75 3.75 0 0 1-5.3-5.3l1.75-1.75" />
    <path d="M14.25 9.75 16 8a3.75 3.75 0 0 1 5.3 5.3l-1.75 1.75" />
    <path stroke={ACCENT} d="m10.4 10.4-1.9-1.9M13.6 13.6l1.9 1.9" />
  </>,
);

export const SignOut: Icon = /*#__PURE__*/ glyph(
  "SignOut",
  <>
    <path d="M9.75 4.25H6.25a2 2 0 0 0-2 2v11.5a2 2 0 0 0 2 2h3.5" />
    <path stroke={ACCENT} d="m15 8.25 3.75 3.75L15 15.75M18.75 12H9" />
  </>,
);

export const SignIn: Icon = /*#__PURE__*/ glyph(
  "SignIn",
  <>
    <path d="M14.25 4.25h3.5a2 2 0 0 1 2 2v11.5a2 2 0 0 1-2 2h-3.5" />
    <path stroke={ACCENT} d="M9 8.25 12.75 12 9 15.75M12.75 12h-9.5" />
  </>,
);

export const Power: Icon = /*#__PURE__*/ glyph(
  "Power",
  <>
    <path d="M7.4 6.4a7.75 7.75 0 1 0 9.2 0" />
    <path stroke={ACCENT} d="M12 2.75v8.5" />
  </>,
);

export const Sun: Icon = /*#__PURE__*/ glyph(
  "Sun",
  <>
    <circle stroke={ACCENT} cx="12" cy="12" r="4.25" />
    <path d="M12 2.75v2.4M12 18.85v2.4M2.75 12h2.4M18.85 12h2.4M5.45 5.45l1.7 1.7M16.85 16.85l1.7 1.7M18.55 5.45l-1.7 1.7M7.15 16.85l-1.7 1.7" />
  </>,
);

export const Moon: Icon = /*#__PURE__*/ glyph(
  "Moon",
  <>
    <path stroke={ACCENT} d="M20.5 14.25A8.75 8.75 0 0 1 9.75 3.5a8.75 8.75 0 1 0 10.75 10.75Z" />
  </>,
);

export const Wifi: Icon = /*#__PURE__*/ glyph(
  "Wifi",
  <>
    <path d="M2.75 9.15a13.15 13.15 0 0 1 18.5 0" />
    <path d="M6.25 12.85a8.1 8.1 0 0 1 11.5 0" />
    <path stroke={ACCENT} d="M9.6 16.55a3.4 3.4 0 0 1 4.8 0" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="19.9" r="1.3" />
  </>,
);

export const WifiSlash: Icon = /*#__PURE__*/ glyph(
  "WifiSlash",
  <>
    <path d="M7.25 6.35a13.15 13.15 0 0 1 14 2.8M2.75 9.15a13.2 13.2 0 0 1 2.4-1.9" />
    <path d="M6.25 12.85a8.1 8.1 0 0 1 3-1.9M14.6 11.55a8.1 8.1 0 0 1 3.15 1.3" />
    <path d="M9.6 16.55a3.4 3.4 0 0 1 3.3-.85" />
    <circle fill={ACCENT} stroke="none" cx="12" cy="19.9" r="1.3" />
    <path stroke={ACCENT} d="m3.75 3.75 16.5 16.5" />
  </>,
);

export const TextT: Icon = /*#__PURE__*/ glyph(
  "TextT",
  <>
    <path stroke={ACCENT} d="M4.75 6.5v-1.75h14.5V6.5M12 4.75v14.5M8.75 19.25h6.5" />
  </>,
);

export const TextBold: Icon = /*#__PURE__*/ glyph(
  "TextBold",
  <>
    <path stroke={ACCENT} d="M7.25 4.75h5.5a3.6 3.6 0 0 1 0 7.25h-5.5V4.75Z" />
    <path stroke={ACCENT} d="M7.25 12h6.5a3.6 3.6 0 0 1 0 7.25h-6.5V12Z" />
  </>,
);

export const TextItalic: Icon = /*#__PURE__*/ glyph(
  "TextItalic",
  <>
    <path stroke={ACCENT} d="M13.25 4.75h6M4.75 19.25h6M16.25 4.75 7.75 19.25" />
  </>,
);

export const TextAlignLeft: Icon = /*#__PURE__*/ glyph(
  "TextAlignLeft",
  <>
    <path d="M3.75 5.75h16.5M3.75 15.25h16.5" />
    <path stroke={ACCENT} d="M3.75 10.5h10.5M3.75 20h10.5" />
  </>,
);

export const TextH1: Icon = /*#__PURE__*/ glyph(
  "TextH1",
  <>
    <path d="M3.5 5.5v13M3.5 12h7.25M10.75 5.5v13" />
    <path stroke={ACCENT} d="m15 10 2.6-1.5v10" />
  </>,
);

export const TextH2: Icon = /*#__PURE__*/ glyph(
  "TextH2",
  <>
    <path d="M3.5 5.5v13M3.5 12h7.25M10.75 5.5v13" />
    <path stroke={ACCENT} d="M14.9 10.15a2.6 2.6 0 1 1 4.5 2.2l-4.5 6.15h5" />
  </>,
);

export const TextH3: Icon = /*#__PURE__*/ glyph(
  "TextH3",
  <>
    <path d="M3.5 5.5v13M3.5 12h7.25M10.75 5.5v13" />
    <path stroke={ACCENT} d="M14.9 9.4a2.5 2.5 0 1 1 2.2 3.6 2.6 2.6 0 1 1-2.2 3.9" />
  </>,
);

export const Hash: Icon = /*#__PURE__*/ glyph(
  "Hash",
  <>
    <path d="M4.25 8.75h15.5M3.75 15.25h15.5" />
    <path stroke={ACCENT} d="M9.75 3.75 7.9 20.25M16.1 3.75l-1.85 16.5" />
  </>,
);

export const PaintBrush: Icon = /*#__PURE__*/ glyph(
  "PaintBrush",
  <>
    <path stroke={ACCENT} d="M17.25 3.45a2.7 2.7 0 0 1 3.3 4.2l-6.5 5.35-3.25-3.25 6.45-6.3Z" />
    <path d="M10.5 10 7.6 12.9a3.4 3.4 0 0 0-1 2.4c0 2.1-1.2 3.35-3.35 4.35 1.9 1.5 4.35 1.9 6.1 1.1a4 4 0 0 0 2.3-3.65 3.4 3.4 0 0 0 2.4-1l1.15-1.15L10.5 10Z" />
  </>,
);

export const Palette: Icon = /*#__PURE__*/ glyph(
  "Palette",
  <>
    <path d="M12 3.25a8.75 8.75 0 0 0 0 17.5c1.25 0 1.9-.9 1.9-1.85 0-1.5-1.35-1.9-1.35-3.1 0-1 .85-1.8 1.9-1.8h1.9a4.4 4.4 0 0 0 4.4-4.4c0-3.6-4-6.35-8.75-6.35Z" />
    <circle fill={ACCENT} stroke="none" cx="8.1" cy="9.25" r="1.35" />
    <circle fill={ACCENT} stroke="none" cx="12.4" cy="7.15" r="1.35" />
    <circle fill={ACCENT} stroke="none" cx="16.4" cy="9.75" r="1.35" />
    <circle fill={ACCENT} stroke="none" cx="7.15" cy="14.25" r="1.35" />
  </>,
);
