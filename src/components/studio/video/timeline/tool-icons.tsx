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

export function MarkInIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M9 4H6v16h3" />
      <path d="M12 12h7M16 9l3 3-3 3" />
    </Frame>
  );
}

export function MarkOutIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M15 4h3v16h-3" />
      <path d="M12 12H5M8 9l-3 3 3 3" />
    </Frame>
  );
}

export function ClearRangeIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7 4H4v16h3M17 4h3v16h-3" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </Frame>
  );
}

export function PlayRangeIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M6 4H3v16h3M18 4h3v16h-3" />
      <path d="M9.5 8v8l6-4z" />
    </Frame>
  );
}

export function LoopIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 11V9a3 3 0 013-3h12l-3-3M20 13v2a3 3 0 01-3 3H5l3 3" />
    </Frame>
  );
}

export function TransparencyGridIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16M12 4v16" />
      <path d="M4 4h8v8H4zM12 12h8v8h-8z" fill="currentColor" stroke="none" opacity="0.45" />
    </Frame>
  );
}

export function MotionBlurIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="16" cy="12" r="4" />
      <path d="M3 9h6M2 12h7M3 15h6" />
    </Frame>
  );
}
