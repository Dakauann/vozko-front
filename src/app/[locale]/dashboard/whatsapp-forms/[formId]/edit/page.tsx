import { FormBuilderPage } from "@/components/whatsapp-forms/FormBuilderPage";

export const dynamic = "force-dynamic";

export default async function WhatsAppFormBuilderRoute({ params }: { params: Promise<{ formId: string }> }) {
  const { formId } = await params;
  return <FormBuilderPage formId={formId} />;
}
