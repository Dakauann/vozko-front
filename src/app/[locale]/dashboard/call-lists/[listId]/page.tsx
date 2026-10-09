import { CallListWorkerPage } from "@/components/call-lists/CallListWorkerPage";

export const dynamic = "force-dynamic";

export default async function CallListWorkerRoute({ params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params;
  return <CallListWorkerPage listId={listId} />;
}
