import LegalDocument from "@/components/legal/legal-document";

/**
 * Section order is the document's numbering — see the note in the terms page.
 *
 * Sections 2-4 are the load-bearing ones: they separate what we control from
 * what we merely process for a customer. Do not reorder them without reading
 * how sections 5 and 13 refer back to that split.
 */
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
