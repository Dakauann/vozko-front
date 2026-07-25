import LeadDetailClient from "./_components/LeadDetailClient"

export const dynamic = "force-dynamic"

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const { leadId } = await params
  return <LeadDetailClient leadId={leadId} />
}
