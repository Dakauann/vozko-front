import { getRequestLocale } from "../../i18n/get-request-locale";
import { redirect } from "next/navigation";

export default async function PrivacyPolicyCanonicalPage() {
  const locale = await getRequestLocale();
  redirect(`/${locale}/privacy-policy`);
}
