import { redirect } from "next/navigation";

// Call billing was merged into the unified Calls page. Keep this route as a
// permanent redirect so existing links and bookmarks resolve.
export default async function CallBillingRedirectPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard/calls`);
}
