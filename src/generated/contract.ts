// AUTO-GENERATED — DO NOT EDIT.
// Generated from the PolicyForge API field contract and refreshed on each
// release, so these schemas always match what the API actually accepts.

import { z } from "zod";

/** Optional business-context fields shared by generate_policy and regenerate_policy. */
export const CONTEXT_FIELDS = {
  website_url: z.string().url().optional().describe("Company website URL."),
  service_description: z.string().min(1).optional().describe("Short description of what the product or service does."),
  data_collection: z.array(z.string()).optional().describe("Categories of personal data collected, e.g. [\"email\",\"name\",\"usage\"]."),
  third_party_integrations: z.array(z.string()).optional().describe("Third-party processors, e.g. [\"Stripe\",\"Google Analytics\"]."),
  data_retention: z.string().min(1).optional().describe("How long data is kept, e.g. \"24 months\"."),
  user_accounts: z.boolean().optional().describe("Does the product have user accounts?"),
  payments: z.boolean().optional().describe("Does it process payments?"),
  marketing: z.boolean().optional().describe("Does it send marketing communications?"),
  analytics: z.boolean().optional().describe("Does it use analytics?"),
  cookies: z.boolean().optional().describe("Does it use cookies? Defaults to true for most websites."),
  children_data: z.boolean().optional().describe("Does it knowingly collect data from children?"),
  target_audience: z.array(z.string()).optional().describe("Audience segments, e.g. [\"businesses\",\"consumers\"]."),
  governing_law: z.string().min(1).optional().describe("Governing law jurisdiction, e.g. \"State of California, USA\"."),
  sells_data: z.boolean().optional().describe("Does it sell or share personal data?"),
  security_measures: z.array(z.string()).optional().describe("Security controls, e.g. [\"encryption at rest\",\"MFA\"]."),
  physical_address: z.string().min(1).optional().describe("Company physical address."),
  dpo_email: z.string().email().optional().describe("Data Protection Officer email, if any. Also sets hasDPO."),
  table_of_contents: z.boolean().optional().describe("Add a linked table of contents to the generated document. Requires a Pro plan."),
};

/** Fields specific to the BAA contract type. */
export const BAA_FIELDS = {
  acknowledge_contract: z.literal(true).describe("Must be true — a Business Associate Agreement is a binding contract, not legal advice, and should be reviewed by counsel before signing."),
  baa_direction: z.enum(["covered_entity_to_vendor", "business_associate_to_client"]).describe("covered_entity_to_vendor (you are the practice) or business_associate_to_client (you are the vendor)."),
  baa_covered_entity_name: z.string().min(1).describe("Legal name of the covered entity."),
  baa_covered_entity_address: z.string().min(1).describe("Address of the covered entity."),
  baa_business_associate_name: z.string().min(1).describe("Legal name of the business associate."),
  baa_business_associate_address: z.string().min(1).describe("Address of the business associate."),
  baa_effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD — the date the parties agree on, not today."),
  baa_services_description: z.string().min(1).describe("The services that bring the associate into contact with PHI."),
  baa_phi_types: z.array(z.string().min(1)).min(1).describe("Categories of PHI involved. Including \"Substance use treatment records (42 CFR Part 2)\" adds a Part 2 addendum."),
  baa_permitted_uses: z.array(z.string().min(1)).min(1).describe("Permitted uses and disclosures per 45 CFR 164.504(e)(2)(i). Anything not listed is not permitted."),
  baa_governing_law_state: z.string().min(1).describe("Governing law state. Stricter state health privacy law is layered on top of HIPAA."),
  baa_electronic_phi: z.boolean().optional().describe("Default true — triggers the HIPAA Security Rule safeguard obligations."),
  baa_uses_subcontractors: z.boolean().optional().describe("Default false — true adds the subcontractor flow-down clause."),
  baa_term_type: z.enum(["tied_to_services", "fixed_term", "perpetual"]).optional().describe("Default tied_to_services (runs with the underlying services agreement)."),
  baa_term_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD — required when baa_term_type is fixed_term."),
  baa_breach_notification_days: z.number().int().min(1).max(60).optional().describe("Days to report a breach after discovery. Default 30. 60 is the outer limit under 45 CFR 164.410."),
  baa_return_or_destroy: z.enum(["either", "return", "destroy"]).optional().describe("What happens to PHI at termination."),
  baa_include_indemnification: z.boolean().optional().describe("Indemnification running from associate to covered entity."),
  baa_include_insurance: z.boolean().optional().describe("Pair with baa_insurance_amount."),
  baa_insurance_amount: z.string().min(1).optional().describe("Minimum cyber liability coverage, e.g. \"$1,000,000 per occurrence\"."),
};
