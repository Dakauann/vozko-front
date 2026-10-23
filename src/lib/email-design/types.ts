export const BLOCK_KINDS = ["heading", "text", "button", "image", "divider", "spacer", "columns", "social", "footer"] as const;

export type BlockKind = (typeof BLOCK_KINDS)[number];

export const PADDINGS = ["s", "m", "l"] as const;

export type Padding = (typeof PADDINGS)[number];

export const ALIGNS = ["left", "center", "right"] as const;

export type Align = (typeof ALIGNS)[number];

export const COLUMN_RATIOS = ["50-50", "33-67", "67-33", "33-33-33"] as const;

export type ColumnRatio = (typeof COLUMN_RATIOS)[number];

export const SOCIAL_NETWORKS = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok", "whatsapp", "website"] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface Settings {
  width?: number;
  background_color?: string;
  content_background_color?: string;
  text_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  font_family?: string;
  preheader?: string;
}

export type ColorSetting = "background_color" | "content_background_color" | "text_color" | "link_color" | "button_color" | "button_text_color";

export interface Link {
  href: string;
}

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  link?: Link;
}

export interface Paragraph {
  runs: Run[];
}

export interface Heading {
  text: string;
  level: number;
  align?: Align;
  color?: string;
}

export interface Text {
  paragraphs: Paragraph[];
  align?: Align;
}

export interface Button {
  label: string;
  href: string;
  align?: Align;
  full_width?: boolean;
  color?: string;
  text_color?: string;
}

export interface Image {
  src: string;
  alt: string;
  href?: string;
  width: number;
  align?: Align;
}

export interface Divider {
  color?: string;
  thickness: number;
}

export interface Spacer {
  height: number;
}

export interface Column {
  blocks: Block[];
}

export interface Columns {
  ratio: ColumnRatio;
  columns: Column[];
}

export interface SocialLink {
  network: SocialNetwork;
  url: string;
  label?: string;
}

export interface Social {
  links: SocialLink[];
  align?: Align;
}

export interface Footer {
  company_name: string;
  address: string;
  text?: string;
}

interface BlockBase {
  id: string;
  padding?: Padding;
  background_color?: string;
}

export interface HeadingBlock extends BlockBase {
  kind: "heading";
  heading: Heading;
}

export interface TextBlock extends BlockBase {
  kind: "text";
  text: Text;
}

export interface ButtonBlock extends BlockBase {
  kind: "button";
  button: Button;
}

export interface ImageBlock extends BlockBase {
  kind: "image";
  image: Image;
}

export interface DividerBlock extends BlockBase {
  kind: "divider";
  divider: Divider;
}

export interface SpacerBlock extends BlockBase {
  kind: "spacer";
  spacer: Spacer;
}

export interface ColumnsBlock extends BlockBase {
  kind: "columns";
  columns: Columns;
}

export interface SocialBlock extends BlockBase {
  kind: "social";
  social: Social;
}

export interface FooterBlock extends BlockBase {
  kind: "footer";
  footer: Footer;
}

export type Block = HeadingBlock | TextBlock | ButtonBlock | ImageBlock | DividerBlock | SpacerBlock | ColumnsBlock | SocialBlock | FooterBlock;

export type BlockOf<K extends BlockKind> = Extract<Block, { kind: K }>;

export type ChildBlock = Exclude<Block, ColumnsBlock | FooterBlock>;

export interface Document {
  version: number;
  settings: Settings;
  blocks: Block[];
}

export interface Issue {
  code: string;
  block_id?: string;
  field?: string;
}

export interface Hint {
  code: string;
  block_id?: string;
}

export interface Starter {
  key: string;
  document: Document;
}
