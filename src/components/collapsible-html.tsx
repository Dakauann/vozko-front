"use client";

import React, { useEffect, useRef, useState } from "react";

type CollapsibleHtmlProps = {
  html: string;
  collapsedHeight?: number; 
  className?: string;
  moreLabel?: string;
  lessLabel?: string;
};

export default function CollapsibleHtml({
  html,
  collapsedHeight = 220,
  className = "",
  moreLabel = "Ver mais",
  lessLabel = "Ver menos",
}: CollapsibleHtmlProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsible, setIsCollapsible] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const measure = () => {
      const prevMax = el.style.maxHeight;
      el.style.maxHeight = "none";
      const fullHeight = el.getBoundingClientRect().height;
      el.style.maxHeight = prevMax;

      setIsCollapsible(fullHeight > collapsedHeight + 4);
    };

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const id = setTimeout(measure, 30);

    return () => {
      ro.disconnect();
      clearTimeout(id);
    };
  }, [html, collapsedHeight]);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={contentRef}
        className="leading-relaxed text-sm prose prose-sm max-w-none transition-[max-height] duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: isExpanded ? undefined : `${collapsedHeight}px` }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {!isExpanded && isCollapsible && (
        <div className="absolute left-0 right-0 bottom-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
      )}

      {isCollapsible && (
        <div className="pt-2 flex items-center justify-center">
          <button
            type="button"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((s) => !s)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted"
          >
            {isExpanded ? lessLabel : moreLabel}
          </button>
        </div>
      )}
    </div>
  );
}
