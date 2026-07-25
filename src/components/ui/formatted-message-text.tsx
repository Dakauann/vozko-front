"use client";

import * as React from "react";

import { LinkPreview, URL_REGEX } from "@/components/ui/linkified-text";
import { parseWhatsAppFormat, type FormatNode } from "@/lib/whatsapp-format";

function renderNodes(nodes: FormatNode[], keyPrefix: string): React.ReactNode {
  return nodes.map((node, i) => {
    const key = `${keyPrefix}.${i}`;

    if (node.type === "text") {
      return <React.Fragment key={key}>{node.value}</React.Fragment>;
    }

    const children = renderNodes(node.children, key);

    switch (node.tag) {
      case "strong":
        return (
          <strong key={key} className="font-semibold">
            {children}
          </strong>
        );
      case "em":
        return <em key={key}>{children}</em>;
      case "del":
        return <del key={key}>{children}</del>;
      case "code":
        return (
          <code
            key={key}
            className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]"
          >
            {children}
          </code>
        );
      case "pre":
        return (
          <code
            key={key}
            className="my-0.5 block overflow-x-auto rounded bg-muted px-2 py-1 font-mono text-[0.9em]"
          >
            {children}
          </code>
        );
    }
  });
}

interface FormattedMessageTextProps {
  children: string;
  className?: string;
}

/**
 * Renders a message body with WhatsApp-style inline formatting
 * (*bold*, _italic_, ~strike~, `code`, ```block```) plus clickable links.
 *
 * URLs are extracted first so that underscores/tildes inside a link are never
 * mistaken for formatting markers; formatting is then applied to the gaps.
 */
export default function FormattedMessageText({
  children,
  className,
}: FormattedMessageTextProps) {
  // split() with one capturing group => odd indices are the matched URLs.
  const parts = children.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <LinkPreview key={i} url={part} />
        ) : (
          <React.Fragment key={i}>
            {renderNodes(parseWhatsAppFormat(part), String(i))}
          </React.Fragment>
        ),
      )}
    </span>
  );
}
