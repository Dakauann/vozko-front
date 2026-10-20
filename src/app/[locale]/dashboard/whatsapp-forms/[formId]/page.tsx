import { FormDetailPage } from "@/components/whatsapp-forms/FormDetailPage";

export const dynamic = "force-dynamic";

export default async function WhatsAppFormDetailRoute({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <FormDetailPage formId={formId} />;
}
