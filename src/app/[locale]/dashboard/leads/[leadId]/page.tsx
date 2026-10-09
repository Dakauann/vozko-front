import { LeadDetail } from "@/components/leads/detail/LeadDetail"

export const dynamic = "force-dynamic"

export default async function LeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const [{ leadId }, { tab }] = await Promise.all([params, searchParams])
  return <LeadDetail leadId={leadId} initialTab={typeof tab === "string" ? tab : undefined} />
}
