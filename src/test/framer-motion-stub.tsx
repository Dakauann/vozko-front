import { createElement, forwardRef, type ReactNode, type Ref } from "react";

const MOTION_ONLY_PROPS = new Set(["initial", "animate", "exit", "transition", "layout", "whileHover", "whileTap"]);

function staticElement(tag: string) {
    const Element = forwardRef((props: Record<string, unknown>, ref: Ref<unknown>) => {
        const rest = Object.fromEntries(Object.entries(props).filter(([key]) => !MOTION_ONLY_PROPS.has(key)));
        return createElement(tag, { ...rest, ref });
    });
    Element.displayName = `motion.${tag}`;
    return Element;
}

export const motion = new Proxy({}, { get: (_target, tag: string) => staticElement(tag) });

export function AnimatePresence({ children }: { children: ReactNode }) {
    return children;
}
