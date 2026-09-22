
export const FAQ_POST_SLUGS = ["novos-custos-meta"] as const;

export type FaqPostSlug = (typeof FAQ_POST_SLUGS)[number];

export type FaqPostEntry = {
  slug: FaqPostSlug;
  key: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
};

export const FAQ_POSTS: readonly FaqPostEntry[] = [
  {
    slug: "novos-custos-meta",
    key: "metaServiceCosts",
    publishedAt: "2026-09-14",
    updatedAt: "2026-09-19",
    readingMinutes: 6,
  },
];

export function getFaqPost(slug: string): FaqPostEntry | undefined {
  return FAQ_POSTS.find((post) => post.slug === slug);
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}
