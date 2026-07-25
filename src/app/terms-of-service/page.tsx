import { getRequestLocale } from "../../i18n/get-request-locale";
import { redirect } from "next/navigation";

export default async function TermsOfServiceCanonicalPage() {
  const locale = await getRequestLocale();
  redirect(`/${locale}/terms-of-service`);
}
