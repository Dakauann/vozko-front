import LegalDocument from "@/components/legal/legal-document";

const SECTIONS = [
  "scope",
  "roles",
  "controllerData",
  "operatorData",
  "lawfulBasis",
  "howWeUse",
  "ai",
  "channels",
  "subprocessors",
  "sharing",
  "security",
  "retention",
  "rights",
  "cookies",
  "children",
  "dpo",
  "changes",
];

const LAST_UPDATED = "2026-08-03";
const VERSION = "2.0";

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      namespace="privacyPolicy"
      sections={SECTIONS}
      lastUpdated={LAST_UPDATED}
      version={VERSION}
    />
  );
}
