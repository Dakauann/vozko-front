"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { createElement, Fragment, useMemo, useState, type CSSProperties, type ReactNode } from "react";

import { Image as ImageGlyph } from "@/components/icons";
import { DEFAULT_DIVIDER_COLOR } from "@/lib/email-design/limits";
import {
  alignOr,
  blockBackground,
  colorOr,
  columnWidths,
  HEADING_SIZES,
  imageWidth,
  OUTER_PADDING,
  paddingBox,
  rootAvailable,
  SOCIAL_SEPARATOR,
  type EmailLook,
} from "@/lib/email-design/look";
import { SOCIAL_NETWORKS, type Block, type ButtonBlock, type ColumnsBlock, type Document, type FooterBlock, type HeadingBlock, type ImageBlock, type Run, type SocialBlock, type TextBlock } from "@/lib/email-design/types";

export interface EmailViewLabels {
  unsubscribe: string;
  imagePlaceholder: string;
  networks: Record<string, string>;
}

export interface Space {
  available: number;
  desktopAvailable: number;
  insideColumns: boolean;
}

export interface BlockSlots {
  heading?: (block: HeadingBlock, style: CSSProperties) => ReactNode;
  text?: (block: TextBlock, style: CSSProperties) => ReactNode;
  column?: (block: ColumnsBlock, column: number, space: Space) => ReactNode;
}

export function useEmailViewLabels(): EmailViewLabels {
  const t = useTranslations("emailEditor");
  return useMemo(
    () => ({
      unsubscribe: t("canvas.unsubscribe"),
      imagePlaceholder: t("canvas.imagePlaceholder"),
      networks: Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, t(`social.networks.${network}`)])),
    }),
    [t],
  );
}

export function rootSpace(look: EmailLook): Space {
  return { available: rootAvailable(look), desktopAvailable: look.width, insideColumns: false };
}

export function textStyle(look: EmailLook, size: number, line: number, color: string, align: string): CSSProperties {
  return { fontFamily: look.font, fontSize: size, lineHeight: `${line}px`, color, textAlign: align as CSSProperties["textAlign"], margin: 0 };
}

export function headingStyle(block: HeadingBlock, look: EmailLook): CSSProperties {
  const size = HEADING_SIZES[block.heading.level] ?? HEADING_SIZES[2];
  return { ...textStyle(look, size.size, size.line, colorOr(block.heading.color, look.text), alignOr(block.heading.align, "left")), fontWeight: 700 };
}

export function paragraphStyle(block: TextBlock, look: EmailLook): CSSProperties {
  return textStyle(look, 16, 26, look.text, alignOr(block.text.align, "left"));
}

export function headingTag(level: number): "h1" | "h2" | "h3" {
  return level === 1 ? "h1" : level === 3 ? "h3" : "h2";
}

function RunView({ run, look }: { run: Run; look: EmailLook }) {
  const parts = run.text.split("\n");
  let node: ReactNode = parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {part}
    </Fragment>
  ));
  if (run.underline) node = <u>{node}</u>;
  if (run.italic) node = <em>{node}</em>;
  if (run.bold) node = <strong>{node}</strong>;
  if (run.link) node = <span style={{ color: look.link, textDecoration: "underline" }}>{node}</span>;
  return <>{node}</>;
}

function StaticText({ block, look }: { block: TextBlock; look: EmailLook }) {
  const style = paragraphStyle(block, look);
  const paragraphs = block.text.paragraphs;
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p key={index} style={{ ...style, marginBottom: index === paragraphs.length - 1 ? 0 : 16 }}>
          {paragraph.runs.length === 0 ? "\u00a0" : paragraph.runs.map((run, runIndex) => <RunView key={runIndex} run={run} look={look} />)}
        </p>
      ))}
    </>
  );
}

function ButtonView({ block, look, inner }: { block: ButtonBlock; look: EmailLook; inner: number }) {
  const button = block.button;
  const align = alignOr(button.align, "center");
  return (
    <div style={{ textAlign: align }}>
      <span
        style={{
          display: button.full_width ? "block" : "inline-block",
          maxWidth: inner,
          padding: "12px 28px",
          fontFamily: look.font,
          fontSize: 16,
          fontWeight: 700,
          lineHeight: "20px",
          color: colorOr(button.text_color, look.buttonText),
          backgroundColor: colorOr(button.color, look.button),
          borderRadius: 6,
          textAlign: "center",
          overflowWrap: "anywhere",
        }}
      >
        {button.label}
      </span>
    </div>
  );
}

function ImagePlaceholder({ width, label }: { width: number; label: string }) {
  return (
    <div
      style={{ width, aspectRatio: "2 / 1", maxWidth: "100%" }}
      className="flex flex-col items-center justify-center gap-1.5 rounded-[--radius] border border-dashed border-control-edge bg-muted text-muted-foreground"
    >
      <ImageGlyph className="h-6 w-6" />
      <span className="px-3 text-center text-xs font-medium">{label}</span>
    </div>
  );
}

function ImageView({ block, inner, desktopInner, label }: { block: ImageBlock; inner: number; desktopInner: number; label: string }) {
  const [failed, setFailed] = useState(false);
  const image = block.image;
  const align = alignOr(image.align, "center");
  const width = Math.max(1, imageWidth(image.width, desktopInner, inner));
  const margin = align === "left" ? "0" : align === "right" ? "0 0 0 auto" : "0 auto";
  const showable = image.src.startsWith("https://") && !failed;
  return (
    <div style={{ display: "flex", justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center" }}>
      {showable ? (
        <Image
          src={image.src}
          alt={image.alt}
          width={width}
          height={Math.round(width / 2)}
          unoptimized
          draggable={false}
          onError={() => setFailed(true)}
          style={{ display: "block", width: "100%", maxWidth: width, height: "auto", margin, border: 0 }}
        />
      ) : (
        <ImagePlaceholder width={width} label={label} />
      )}
    </div>
  );
}

function SocialView({ block, look, networks }: { block: SocialBlock; look: EmailLook; networks: Record<string, string> }) {
  const social = block.social;
  const label = (link: SocialBlock["social"]["links"][number]) => {
    if (link.label && link.label.trim() !== "") return link.label;
    if (link.network !== "website" && networks[link.network]) return networks[link.network];
    try {
      return new URL(link.url).host || link.url;
    } catch {
      return link.url;
    }
  };
  return (
    <p style={textStyle(look, 14, 22, look.text, alignOr(social.align, "center"))}>
      {social.links.map((link, index) => (
        <Fragment key={index}>
          {index > 0 ? SOCIAL_SEPARATOR : null}
          <span style={{ color: look.link, fontWeight: 700 }}>{label(link)}</span>
        </Fragment>
      ))}
    </p>
  );
}

function multiline(text: string): ReactNode {
  return text.split("\n").map((line, index) => (
    <Fragment key={index}>
      {index > 0 ? <br /> : null}
      {line}
    </Fragment>
  ));
}

function FooterView({ block, look, unsubscribe }: { block: FooterBlock; look: EmailLook; unsubscribe: string }) {
  const style = textStyle(look, 12, 18, look.text, "center");
  const footer = block.footer;
  return (
    <>
      {footer.text && footer.text.trim() !== "" ? <p style={{ ...style, marginBottom: 8 }}>{multiline(footer.text)}</p> : null}
      <p style={{ ...style, marginBottom: 8 }}>
        {footer.company_name}
        <br />
        {footer.address}
      </p>
      <p style={style}>
        <span style={{ color: look.link, textDecoration: "underline" }}>{unsubscribe}</span>
      </p>
    </>
  );
}

function StaticColumn({ block, column, space, look, labels }: { block: ColumnsBlock; column: number; space: Space; look: EmailLook; labels: EmailViewLabels }) {
  return (
    <>
      {block.columns.columns[column]?.blocks.map((child) => (
        <BlockView key={child.id} block={child} look={look} space={space} labels={labels} />
      ))}
    </>
  );
}

function ColumnsView({ block, look, inner, desktopInner, labels, slots }: { block: ColumnsBlock; look: EmailLook; inner: number; desktopInner: number; labels: EmailViewLabels; slots?: BlockSlots }) {
  const widths = columnWidths(block.columns.ratio, inner);
  const desktopWidths = columnWidths(block.columns.ratio, desktopInner);
  return (
    <div style={{ display: "flex", flexDirection: look.mobile ? "column" : "row", alignItems: "flex-start" }}>
      {block.columns.columns.map((_, index) => {
        const width = look.mobile ? inner : (widths[index] ?? 0);
        const space: Space = { available: width, desktopAvailable: desktopWidths[index] ?? width, insideColumns: true };
        return (
          <div key={index} style={{ width, maxWidth: "100%", flex: "none" }}>
            {slots?.column ? slots.column(block, index, space) : <StaticColumn block={block} column={index} space={space} look={look} labels={labels} />}
          </div>
        );
      })}
    </div>
  );
}

export function BlockView({ block, look, space, labels, slots }: { block: Block; look: EmailLook; space: Space; labels: EmailViewLabels; slots?: BlockSlots }) {
  const background = blockBackground(block);
  if (block.kind === "spacer") {
    return <div aria-hidden style={{ height: block.spacer.height, backgroundColor: background }} />;
  }
  const box = paddingBox(block.padding, space.insideColumns, look);
  const inner = Math.max(0, space.available - 2 * box.horizontal);
  const desktopInner = Math.max(0, space.desktopAvailable - 2 * paddingBox(block.padding, space.insideColumns, { ...look, mobile: false }).horizontal);
  let content: ReactNode = null;
  switch (block.kind) {
    case "heading": {
      const style = headingStyle(block, look);
      content = slots?.heading ? slots.heading(block, style) : createElement(headingTag(block.heading.level), { style: { ...style, overflowWrap: "anywhere" } }, block.heading.text);
      break;
    }
    case "text":
      content = slots?.text ? slots.text(block, paragraphStyle(block, look)) : <StaticText block={block} look={look} />;
      break;
    case "button":
      content = <ButtonView block={block} look={look} inner={inner} />;
      break;
    case "image":
      content = <ImageView key={block.image.src} block={block} inner={inner} desktopInner={desktopInner} label={labels.imagePlaceholder} />;
      break;
    case "divider":
      content = <div style={{ borderTop: `${block.divider.thickness}px solid ${colorOr(block.divider.color, DEFAULT_DIVIDER_COLOR)}` }} />;
      break;
    case "columns":
      content = <ColumnsView block={block} look={look} inner={inner} desktopInner={desktopInner} labels={labels} slots={slots} />;
      break;
    case "social":
      content = <SocialView block={block} look={look} networks={labels.networks} />;
      break;
    case "footer":
      content = <FooterView block={block} look={look} unsubscribe={labels.unsubscribe} />;
      break;
  }
  return <div style={{ padding: `${box.vertical}px ${box.horizontal}px`, backgroundColor: background }}>{content}</div>;
}

export function EmailFrame({ look, children, className, frameWidth }: { look: EmailLook; children: ReactNode; className?: string; frameWidth?: number }) {
  return (
    <div className={className} style={{ backgroundColor: look.background, padding: `${OUTER_PADDING}px 0`, width: frameWidth }}>
      <div style={{ width: look.mobile ? "100%" : look.width, maxWidth: "100%", margin: "0 auto", backgroundColor: look.content }}>{children}</div>
    </div>
  );
}

export function StaticEmail({ document, look, labels }: { document: Document; look: EmailLook; labels: EmailViewLabels }) {
  const space = rootSpace(look);
  return (
    <EmailFrame look={look}>
      {document.blocks.map((block) => (
        <BlockView key={block.id} block={block} look={look} space={space} labels={labels} />
      ))}
    </EmailFrame>
  );
}

