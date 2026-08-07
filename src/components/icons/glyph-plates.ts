/**
 * One glyph, one plate colour, product-wide.
 *
 * The tiles were coloured per call site, so the same icon wore a different
 * colour on every page it appeared on: `ChartBar` was brand orange on the
 * hourly-volume panel and neutral grey three sections later, `Robot` was amber
 * on one surface and violet on another. That is not a colour system, it is
 * fourteen separate authors, and it is why the tiles read as decoration — an
 * operator cannot learn a colour that never means the same thing twice.
 *
 * So the colour is a property of the MARK, not of the surface it lands on.
 * Look the glyph up here and the whole product agrees.
 *
 * The plates themselves are the lockup shape defined in `globals.css`: an
 * opaque fill carrying that fill's own measured foreground, the same shape the
 * WhatsApp channel mark has always used. Channel marks are not in this table —
 * they keep their real brand colours and live in `channels/channel-tile.tsx`.
 *
 * The five `tile-1..5` plates are the chart series, so a category reads the
 * same in a tile as it does in the graph beside it:
 *
 *   tile-1  indigo   quantity, volume, the thing being counted
 *   tile-2  green    organisation, structure, where work is filed
 *   tile-3  amber    time, speed, scheduling
 *   tile-4  cyan     distribution, composition, share-of
 *   tile-5  violet   automation and AI
 *
 * `tile-brand` / `tile-healthy` / `tile-warning` / `tile-fault` / `tile-info`
 * stay reserved for their meanings: the product's own primary object, and the
 * four states. A glyph only takes a status plate when the glyph itself IS the
 * status — `Warning`, `CheckCircle`, `XCircle` — never as decoration.
 */
export const GLYPH_PLATE = {
  /* Measurement and analytics. */
  ChartBar: "tile-1",
  ChartLine: "tile-1",
  ChartLineUp: "tile-1",
  Pulse: "tile-1",
  TrendUp: "tile-1",
  TrendDown: "tile-1",
  ChartPie: "tile-4",
  ChartPieSlice: "tile-4",
  Percent: "tile-4",

  /* Organisation: where a thing is filed, who owns it. */
  Buildings: "tile-2",
  Folder: "tile-2",
  Tag: "tile-2",
  Kanban: "tile-2",
  Stack: "tile-2",
  Users: "tile-2",
  UsersThree: "tile-2",
  User: "tile-2",
  UserCircle: "tile-2",
  Student: "tile-2",

  /* Time and speed. */
  Clock: "tile-3",
  ClockCounterClockwise: "tile-3",
  Timer: "tile-3",
  Hourglass: "tile-3",
  CalendarBlank: "tile-3",
  Calendar: "tile-3",
  Lightning: "tile-3",

  /* Automation and AI. */
  Robot: "tile-5",
  Sparkle: "tile-5",
  MagicWand: "tile-5",
  Brain: "tile-5",
  FlowArrow: "tile-5",
  GitBranch: "tile-5",
  Lightbulb: "tile-5",

  /* The product's own primary objects — what the operator came here to work. */
  Megaphone: "tile-brand",
  PaperPlaneTilt: "tile-brand",
  ChatCircle: "tile-brand",
  ChatCircleDots: "tile-brand",
  ChatsCircle: "tile-brand",
  EnvelopeSimple: "tile-brand",
  Rocket: "tile-brand",
  Target: "tile-brand",

  /* Money. Amber, because it is a quantity read against time far more often
     than it is a status — a balance is not "good" or "bad" on sight. */
  Wallet: "tile-3",
  CurrencyDollar: "tile-3",
  Money: "tile-3",
  Receipt: "tile-3",
  CreditCard: "tile-3",
  Invoice: "tile-3",

  /* Glyphs that ARE a state. These are the only decorative-looking tiles
     allowed to wear a status colour, because the mark carries the meaning. */
  CheckCircle: "tile-healthy",
  Check: "tile-healthy",
  SealCheck: "tile-healthy",
  ShieldCheck: "tile-healthy",
  Warning: "tile-warning",
  WarningCircle: "tile-warning",
  WarningOctagon: "tile-fault",
  XCircle: "tile-fault",
  Trash: "tile-fault",
  Prohibit: "tile-fault",
  Info: "tile-info",
  Question: "tile-info",

  /* Configuration and plumbing. Neutral on purpose: settings are where the
     operator goes deliberately, never something the page should advertise. */
  Gear: "tile-neutral",
  GearSix: "tile-neutral",
  Wrench: "tile-neutral",
  Plug: "tile-neutral",
  PlugsConnected: "tile-neutral",
  Key: "tile-neutral",
  Lock: "tile-neutral",
  Database: "tile-neutral",
  Code: "tile-neutral",
  Webhooks: "tile-neutral",
  FileText: "tile-neutral",
  Files: "tile-neutral",
  Book: "tile-neutral",
  BookOpen: "tile-neutral",
} as const;

export type GlyphName = keyof typeof GLYPH_PLATE;

/** The plate for a glyph, falling back to neutral rather than to the accent:
 *  an unmapped icon should recede, not claim the one colour that means commit. */
export function glyphPlate(name: string): string {
  return GLYPH_PLATE[name as GlyphName] ?? "tile-neutral";
}
