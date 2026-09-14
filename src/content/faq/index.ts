/**
 * The FAQ's register of posts.
 *
 * Slugs are canonical across all four locales, so `/pt/faq/novos-custos-meta`
 * and `/en/faq/novos-custos-meta` are the same document. A link then survives a
 * language switch and there is one URL to share, which is what a support team
 * actually needs. Only the body is translated.
 *
 * Adding a post means three things: one entry here, one `faq.posts.<key>` block
 * in each of the four locale files, and one case in `faq-post.tsx`.
 */

export const FAQ_POST_SLUGS = ["novos-custos-meta"] as const;

export type FaqPostSlug = (typeof FAQ_POST_SLUGS)[number];

export type FaqPostEntry = {
  slug: FaqPostSlug;
  /** Key under `faq.posts` in the locale files. */
  key: string;
  /** ISO dates, rendered through the reader's own locale. */
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
};

export const FAQ_POSTS: readonly FaqPostEntry[] = [
  {
    slug: "novos-custos-meta",
    key: "metaServiceCosts",
    publishedAt: "2026-09-14",
    updatedAt: "2026-09-14",
    readingMinutes: 8,
  },
];

export function getFaqPost(slug: string): FaqPostEntry | undefined {
  return FAQ_POSTS.find((post) => post.slug === slug);
}

/**
 * `new Date("2026-09-14")` is parsed as UTC midnight, which renders as the 13th
 * for every reader west of Greenwich, Brazil included. A publication date is a
 * calendar date, not an instant, so it is built in local time.
 */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
