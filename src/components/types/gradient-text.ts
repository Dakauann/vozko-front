export type GradientTextProps = {
    children: React.ReactNode;
    as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
    alignment?: "left" | "center" | "right";
    gradientDirection?: number;
    startColor?: string;
    endColor?: string;
    startPosition?: number;
    endPosition?: number;
    className?: string;
    containerClassName?: string;
};