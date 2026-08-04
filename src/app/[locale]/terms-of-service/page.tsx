import LegalDocument from "@/components/legal/legal-document";

/**
 * Section order is the document's numbering, so it lives here rather than in the
 * translations: renumbering a clause must be a deliberate code change, not a
 * side effect of editing copy in one locale.
 *
 * Sections 5-7 (acceptable use, channel rules, contact consent) carry the
 * substantive obligations; keep them adjacent and in that order.
 */
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

/**
 * Bump both when the text changes materially. The date is fixed, never
 * `new Date()`: a legal document that claims to have been updated today, every
 * day, tells the reader nothing and is unciteable.
 */
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
