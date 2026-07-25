import AdminIssueDetailClient from "./_components/AdminIssueDetailClient";

interface PageProps {
  params: Promise<{ issueId: string }>;
}

export default async function AdminIssueDetailPage({ params }: PageProps) {
  const { issueId } = await params;
  return <AdminIssueDetailClient issueId={issueId} />;
}
