import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Frame({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

export function SelectToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M6 4l11 7-5 1.5 3 5.5-2 1-3-5.5-4 3.5z" />
    </Frame>
  );
}

export function BladeToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 3v18" />
      <path d="M8 6h8l-2 4h-4z" />
      <path d="M5 15h3M16 15h3" />
    </Frame>
  );
}

export function RippleToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 6v12M4 12h7" />
      <path d="M8 9l3 3-3 3" />
      <path d="M15 8h5v8h-5" />
    </Frame>
  );
}

export function RollToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M12 5v14" />
      <path d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
    </Frame>
  );
}

export function SlipToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M5 6v12M19 6v12" />
      <path d="M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2" />
    </Frame>
  );
}

export function SlideToolIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M3 8h4v8H3M21 8h-4v8h4" />
      <path d="M9 9h6v6H9z" />
    </Frame>
  );
}
