import LegalDocument from "@/components/legal/legal-document";

const SECTIONS = [
  "agreement",
  "definitions",
  "account",
  "plans",
  "acceptableUse",
  "channelRules",
  "contactConsent",
  "ai",
  "customerData",
  "availability",
  "intellectualProperty",
  "confidentiality",
  "suspension",
  "warranties",
  "liability",
  "indemnity",
  "changes",
  "governingLaw",
  "general",
];

const LAST_UPDATED = "2026-08-03";
const VERSION = "2.0";

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      namespace="termsOfService"
      sections={SECTIONS}
      lastUpdated={LAST_UPDATED}
      version={VERSION}
    />
  );
}
