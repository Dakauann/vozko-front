import IssueDetailClient from "./_components/IssueDetailClient";

export const dynamic = "force-dynamic";

interface IssueDetailPageProps {
  params: Promise<{ issueId: string }>;
}

export default async function IssueDetailPage({
  params,
}: IssueDetailPageProps) {
  const { issueId } = await params;

  return <IssueDetailClient issueId={issueId} />;
}
