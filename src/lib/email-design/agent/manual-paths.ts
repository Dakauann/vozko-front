import { at, by, type ManualEntry, type ToolEntry } from "@/lib/coworker/manual-paths";

const EDITOR = "components/email-editor";
const INSPECTOR = `${EDITOR}/inspector.tsx`;
const CANVAS = `${EDITOR}/canvas.tsx`;
const TOOLBAR = `${EDITOR}/email-editor.tsx`;

const field = (key: string, how: string) => by(at(INSPECTOR, `emailEditor.inspector.fields.${key}`, how));

export const EMAIL_OPERATION_PATHS: Readonly<Record<string, ManualEntry>> = {
  add: by(
    at(`${EDITOR}/palette.tsx`, "emailEditor.palette.title", "Blocks list on the left: drag a block or tap it to add it after the selection"),
    at(CANVAS, "emailEditor.canvas.insertHere", "The + between blocks inserts a block right there"),
    at(CANVAS, "emailEditor.canvas.addToColumn", "Inside columns: the + of each column adds a block to it"),
  ),
  set: by(
    at(INSPECTOR, "emailEditor.inspector.groups.content", "Select a block: the inspector on the right edits every field of it"),
    at(CANVAS, "emailEditor.canvas.editText", "Headings and texts are edited in place on the canvas, with bold, italic, underline and links"),
  ),
  move: by(
    at(CANVAS, "emailEditor.toolbar.moveUp", "Block toolbar: move up and down, or Alt + arrows"),
    at(CANVAS, "emailEditor.toolbar.drag", "Drag the block handle to any place, columns included"),
  ),
  remove: by(at(CANVAS, "emailEditor.toolbar.remove", "Block toolbar: delete, or Delete with the block selected")),
  duplicate: by(at(CANVAS, "emailEditor.toolbar.duplicate", "Block toolbar: duplicate, or Ctrl+D")),
  settings: by(at(TOOLBAR, "emailEditor.toolbar.documentSettings", "Gear in the toolbar, or no block selected: width, colors, font and preheader")),
};

export const EMAIL_FIELD_PATHS: Readonly<Record<string, ManualEntry>> = {
  text: by(at(CANVAS, "emailEditor.canvas.editText", "Typed in place on the canvas; footer text in the inspector"), at(INSPECTOR, "emailEditor.inspector.fields.footerText", "Footer: its text in the inspector")),
  level: field("level", "Heading size"),
  align: field("align", "Alignment buttons"),
  color: by(at(INSPECTOR, "emailEditor.inspector.fields.headingColor", "Heading color"), at(INSPECTOR, "emailEditor.inspector.fields.dividerColor", "Divider color"), at(INSPECTOR, "emailEditor.inspector.fields.buttonColor", "Button color")),
  label: field("buttonLabel", "Button text"),
  href: by(at(INSPECTOR, "emailEditor.inspector.fields.href", "Button link"), at(INSPECTOR, "emailEditor.inspector.fields.imageHref", "Image link")),
  full_width: field("buttonWidth", "Button width: fit or full"),
  text_color: by(at(INSPECTOR, "emailEditor.inspector.fields.buttonTextColor", "Button text color"), at(INSPECTOR, "emailEditor.inspector.fields.textColor", "Email text color in the email settings")),
  src: field("src", "Image address"),
  media_id: by(at(`${EDITOR}/image-source.tsx`, "emailEditor.inspector.imageSource.choose", "Image block: Choose an image uploads one, picks from the library or generates it with AI")),
  alt: field("alt", "Alternative text"),
  width: by(at(INSPECTOR, "emailEditor.inspector.fields.imageWidth", "Image width"), at(INSPECTOR, "emailEditor.inspector.fields.width", "Email width in the email settings")),
  thickness: field("thickness", "Divider thickness"),
  height: field("height", "Spacer height"),
  ratio: field("ratio", "Columns ratio"),
  links: by(at(INSPECTOR, "emailEditor.inspector.fields.network", "Social block: networks, addresses and labels"), at(INSPECTOR, "emailEditor.inspector.social.add", "Social block: add a network")),
  company_name: field("company", "Footer company"),
  address: field("address", "Footer address"),
  padding: field("padding", "Block inner spacing"),
  background_color: by(at(INSPECTOR, "emailEditor.inspector.fields.blockBackground", "Block background"), at(INSPECTOR, "emailEditor.inspector.fields.backgroundColor", "Outer background in the email settings")),
  content_background_color: field("contentBackgroundColor", "Content background in the email settings"),
  link_color: field("linkColor", "Link color in the email settings"),
  button_color: field("buttonColor", "Default button color in the email settings"),
  button_text_color: field("buttonTextColor", "Default button text color in the email settings"),
  font_family: field("font", "Font in the email settings"),
  preheader: field("preheader", "Preheader in the email settings"),
};

export const EMAIL_TOOL_PATHS: Readonly<Record<string, ToolEntry>> = {
  email_read: { perception: "How Elo reads the open design; a person sees the canvas, the inspector and the issues rail" },
  email_edit: by(at(INSPECTOR, "emailEditor.inspector.groups.content", "Every operation of the batch is a manual edit of the canvas, the blocks list or the inspector")),
  email_look: by(
    at(TOOLBAR, "emailEditor.toolbar.preview", "Preview mode shows the rendered email the backend sends"),
    at(TOOLBAR, "emailEditor.toolbar.mobile", "Desktop and mobile widths"),
    at(TOOLBAR, "emailEditor.toolbar.darkBackdrop", "Dark backdrop in the preview"),
  ),
  email_generate_image: by(at(`${EDITOR}/image-source.tsx`, "emailEditor.inspector.imageSource.choose", "Image block: Choose an image, then Generate with AI with the prompt, format, model and references")),
  new_email_design: by(at("components/email-campaigns/designs/EmailDesignsGallery.tsx", "emailCampaigns.designs.new", "Email templates page: New template from a starter")),
};
