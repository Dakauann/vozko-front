const ACCENT = "var(--icon-accent, currentColor)";

export function ElementsGlyph({ className, size = 18 }: { className?: string; size?: number | string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="7.75" cy="7.75" r="4" stroke={ACCENT} />
      <path d="M17.25 3.75 21 10.25h-7.5Z" />
      <rect x="3.75" y="13.75" width="16.5" height="6.5" rx="2" />
    </svg>
  );
}
