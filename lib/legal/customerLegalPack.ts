/** Customer legal pack v1.0 — customer-facing text only (implementation notes omitted). */

export const LEGAL_ENTITY = {
  name: "ProjectPlanner Systems Ltd",
  tradingName: 'ProjectPlanner',
  registeredOffice: "71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ",
  website: 'https://projectplanner.us',
  privacyEmail: "info@projectplanner.us",
  supportEmail: "info@projectplanner.us",
  version: '1.0',
  effectiveDate: '18 September 2026',
} as const

export type LegalDocumentId = 'saas' | 'dpa' | 'aup' | 'privacy'

export type LegalSection = {
  title: string
  paragraphs: string[]
  bullets?: string[]
}

export type LegalDocument = {
  id: LegalDocumentId
  title: string
  intro: string
  acceptLabel: string
  acknowledgeOnly: boolean
  sections: LegalSection[]
}

export const LEGAL_PACK_DOCUMENTS: LegalDocument[] = [
  {
    id: "saas",
    title: "SaaS Agreement",
    intro: "This SaaS Agreement is between ProjectPlanner Systems Ltd, trading as ProjectPlanner (the “Provider”), and the organisation identified in the customer account (the “Customer”). It governs the Customer’s use of the ProjectPlanner software platform.",
    acceptLabel: "I agree to the ProjectPlanner SaaS Agreement",
    acknowledgeOnly: false,
    sections: [
      {
        title: "1. Definitions",
        paragraphs: [
          "“Account” means the Customer account used to access the Platform. “Authorised User” means an individual permitted by the Customer to use the Platform under the Customer’s subscription. “Customer Data” means data, documents, files, records and other information submitted to or stored in the Platform by or for the Customer. “Platform” means the ProjectPlanner software application, website, services and related functionality supplied by the Provider. “Subscription” means the paid subscription selected by the Customer. “Subscription Fees” means the fees shown on the applicable order, pricing page or invoice. “Term” means the period for which the Subscription is active.",
        ],
      },
      {
        title: "2. Provision of the Platform",
        paragraphs: [
          "The Provider grants the Customer a limited, non-exclusive, non-transferable right during the Term to access and use the Platform for the Customer’s internal business purposes. The Customer may permit its Authorised Users to access the Platform, subject to any user or licence limits applicable to its Subscription. The Provider may make reasonable changes to the Platform where necessary for security, maintenance, legal compliance, technical improvement or product development.",
        ],
      },
      {
        title: "3. Account and User Responsibilities",
        paragraphs: [
          "The Customer is responsible for keeping login credentials confidential, controlling access to its accounts and ensuring that Authorised Users comply with this Agreement. The Customer must not share accounts in a way that circumvents user limits, attempt to gain unauthorised access, interfere with the Platform, reverse engineer the Platform except where the law expressly permits it, or use the Platform for unlawful purposes. The Customer is responsible for the accuracy, legality and appropriateness of Customer Data and for obtaining any permissions needed to upload or process it.",
        ],
      },
      {
        title: "4. Fees and Payment",
        paragraphs: [
          "Subscription Fees are payable in accordance with the applicable order, invoice or pricing arrangement. Unless otherwise agreed in writing, invoices are payable within 14 days of invoice date. The Provider may suspend access for materially overdue undisputed amounts after giving reasonable notice. All fees are exclusive of VAT unless stated otherwise. The Customer is responsible for applicable taxes other than taxes imposed on the Provider’s profits.",
        ],
      },
      {
        title: "5. Term, Renewal and Cancellation",
        paragraphs: [
          "The Subscription begins on the date shown in the order or account and continues for the agreed subscription period. Unless the applicable order states otherwise, a monthly Subscription renews monthly and an annual Subscription renews annually. Either party may terminate for material breach if the breach is not remedied within 14 days after written notice. The Provider may terminate or suspend immediately where necessary to address a serious security risk, unlawful use, or material threat to the Platform. The Customer may cancel future renewal in accordance with the cancellation method stated in the account or order. Fees already paid are non-refundable unless expressly stated otherwise.",
        ],
      },
      {
        title: "6. Customer Data",
        paragraphs: [
          "As between the parties, the Customer retains ownership of Customer Data. The Provider may process Customer Data only to provide, secure, maintain, support and improve the Platform as permitted by this Agreement and the Data Processing Agreement where applicable. The Provider does not acquire ownership of Customer Data merely because it is stored in the Platform.",
        ],
      },
      {
        title: "7. Intellectual Property",
        paragraphs: [
          "The Platform, software, source code, designs, interfaces, documentation, trademarks and related intellectual property are owned by or licensed to the Provider and remain the Provider’s property. Except for the limited access right expressly granted by this Agreement, no intellectual property rights are transferred to the Customer. The Customer must not copy, reproduce, sell, rent, sublicense, distribute or commercially exploit the Platform except as expressly permitted by this Agreement.",
        ],
      },
      {
        title: "8. Availability and Support",
        paragraphs: [
          "The Provider will use reasonable care and skill in providing the Platform. The Platform may occasionally be unavailable because of maintenance, upgrades, faults, internet or third-party service failures, security incidents or circumstances outside the Provider’s reasonable control. Unless a separate service level agreement applies, the Provider does not guarantee uninterrupted or error-free availability. Support arrangements are those stated in the Customer’s order, pricing plan or published support information.",
        ],
      },
      {
        title: "9. Third-Party Services",
        paragraphs: [
          "The Platform may use third-party infrastructure, hosting, email, authentication, analytics, payment or other services. The Provider may change a third-party service where reasonably necessary, provided that the replacement does not materially reduce the core functionality of the Platform. Third-party services may have their own terms and privacy notices.",
        ],
      },
      {
        title: "10. Security",
        paragraphs: [
          "The Provider will maintain appropriate technical and organisational measures designed to protect Customer Data against unauthorised access, accidental loss, destruction or alteration, taking account of the nature and risks of the processing. The Customer is responsible for maintaining appropriate security on its own devices, accounts and networks and for using strong passwords and access controls.",
        ],
      },
      {
        title: "11. Confidentiality",
        paragraphs: [
          "Each party must keep confidential information received from the other party confidential and use it only for the purposes of performing or receiving the services. This obligation does not apply to information that is public without breach, already lawfully known, independently developed, or required to be disclosed by law. The confidentiality obligations continue for three years after termination, except for information that remains a trade secret, which will remain protected for so long as it qualifies as such.",
        ],
      },
      {
        title: "12. Warranties and Disclaimer",
        paragraphs: [
          "The Provider warrants that it will provide the Platform with reasonable care and skill. Except for express warranties in this Agreement, the Platform is provided on an “as available” basis. The Provider does not warrant that the Platform will meet every Customer requirement, be completely uninterrupted or be free from every defect. The Platform is a project-management tool and does not replace the Customer’s own professional judgement, construction management duties, health and safety responsibilities, contractual obligations, statutory duties or professional advice.",
        ],
      },
      {
        title: "13. Liability",
        paragraphs: [
          "Nothing in this Agreement excludes or limits liability that cannot lawfully be excluded or limited, including liability for death or personal injury caused by negligence, fraud or fraudulent misrepresentation, or any other liability that cannot legally be limited. Subject to the above, neither party is liable for indirect or consequential loss, loss of profits, revenue, goodwill or anticipated savings, except to the extent such exclusion is prohibited by law. Subject to the above, each party’s total aggregate liability arising out of or in connection with the Agreement is capped at the greater of (a) the Subscription Fees paid or payable by the Customer in the 12 months preceding the event giving rise to the claim and (b) £5,000. The liability cap does not limit the Customer’s payment obligations or the parties’ obligations relating to confidentiality, intellectual property infringement, or data protection to the extent that a different treatment is required by law or expressly agreed in the DPA.",
        ],
      },
      {
        title: "14. Indemnity for Customer Data and Misuse",
        paragraphs: [
          "The Customer is responsible for ensuring that its use of the Platform and Customer Data does not infringe law or third-party rights. The Customer will indemnify the Provider against third-party claims arising directly from the Customer’s unlawful use of the Platform or unlawful Customer Data, except to the extent caused by the Provider’s breach of this Agreement or applicable law.",
        ],
      },
      {
        title: "15. Suspension",
        paragraphs: [
          "The Provider may temporarily suspend access where reasonably necessary to protect the Platform, other customers, personal data, the Provider’s systems, or the Customer itself, or where the Customer materially breaches this Agreement. Where practicable, the Provider will give advance notice and will restore access once the relevant issue has been resolved.",
        ],
      },
      {
        title: "16. Effect of Termination",
        paragraphs: [
          "On termination, the Customer’s right to access the Platform ends, except for any agreed post-termination export period. The Provider will make Customer Data available for export for up to 30 days after termination where technically practicable. After that period, the Provider may delete Customer Data, subject to legal retention requirements and the DPA. Any unpaid fees that became due before termination remain payable.",
        ],
      },
      {
        title: "17. Changes to Terms",
        paragraphs: [
          "The Provider may update these terms where reasonably necessary to reflect changes in law, security requirements, technology or the Platform. For material adverse changes, the Provider will give reasonable advance notice. The version accepted by the Customer will be retained in the Provider’s records. Changes will not retrospectively alter accrued rights or obligations.",
        ],
      },
      {
        title: "18. General",
        paragraphs: [
          "Neither party may assign this Agreement except to a successor in connection with a genuine business transfer, merger or sale, subject to the other party’s legitimate interests. If any provision is invalid or unenforceable, the remaining provisions remain in effect. A failure to enforce a provision is not a waiver. This Agreement and the documents expressly incorporated into it constitute the agreement between the parties regarding the Platform and supersede earlier discussions on the same subject. A person who is not a party to this Agreement has no right to enforce it under the Contracts (Rights of Third Parties) Act 1999, except where expressly stated.",
        ],
      },
      {
        title: "19. Governing Law and Jurisdiction",
        paragraphs: [
          "This Agreement is governed by the law of England and Wales. The courts of England and Wales have exclusive jurisdiction, subject to any mandatory rights or jurisdiction that cannot lawfully be excluded.",
        ],
      },
    ],
  },
  {
    id: "dpa",
    title: "Data Processing Agreement",
    intro: "This Data Processing Agreement (“DPA”) forms part of the SaaS Agreement where the Provider processes personal data on behalf of the Customer. The Customer is generally the controller and the Provider is generally the processor for Customer Data processed solely to provide the Platform. The parties acknowledge that their actual roles depend on who determines the purposes and means of each processing activity.",
    acceptLabel: "I agree to the ProjectPlanner Data Processing Agreement",
    acknowledgeOnly: false,
    sections: [
      {
        title: "1. Subject Matter and Duration",
        paragraphs: [
          "The Provider processes personal data for the duration of the Customer’s use of the Platform and for the limited period required to complete deletion, export or legal retention after termination.",
        ],
      },
      {
        title: "2. Nature and Purpose",
        paragraphs: [
          "Processing is carried out to provide account management, project management, document and record storage, user administration, communications, technical support, security, backups, service monitoring and other functions necessary to provide the Platform. The Provider will not use Customer personal data for unrelated purposes unless permitted by law or separately agreed with the Customer.",
        ],
      },
      {
        title: "3. Categories of Data",
        paragraphs: [
          "Depending on the Customer’s use of the Platform, personal data may include names, work email addresses, telephone numbers, job titles, company details, project roles, user account information, correspondence, project records, uploaded documents, photographs, site records and similar business information. The Customer must not intentionally upload special category personal data, criminal offence data, or highly sensitive personal information unless the parties have agreed that the Platform is appropriate for that purpose and the necessary safeguards are in place.",
        ],
      },
      {
        title: "4. Categories of Data Subjects",
        paragraphs: [
          "Data subjects may include the Customer’s employees, directors, workers, contractors, subcontractors, consultants, suppliers, clients, site personnel and other individuals whose information the Customer chooses to store in the Platform.",
        ],
      },
      {
        title: "5. Customer Instructions and Responsibilities",
        paragraphs: [
          "The Provider will process Customer personal data only on the Customer’s documented instructions, including instructions in this DPA, except where processing is required by UK law. The Customer is responsible for establishing an appropriate lawful basis for its processing, providing required privacy information to data subjects, and ensuring that its instructions and Customer Data comply with applicable law.",
        ],
      },
      {
        title: "6. Confidentiality",
        paragraphs: [
          "The Provider will ensure that persons authorised to process Customer personal data are subject to confidentiality obligations or an appropriate statutory duty of confidentiality.",
        ],
      },
      {
        title: "7. Security Measures",
        paragraphs: [
          "The Provider will maintain appropriate technical and organisational measures appropriate to the risk, which may include access controls, authentication, encryption in transit, secure hosting, backups, logging, restricted administrative access, vulnerability management and incident response procedures. The exact security architecture may change as the Platform develops, provided that the Provider continues to maintain measures appropriate to the processing risk.",
        ],
      },
      {
        title: "8. Sub-processors",
        paragraphs: [
          "The Customer gives general authorisation for the Provider to use sub-processors reasonably required to operate the Platform, including hosting, database, authentication, email, monitoring, support and backup providers. The Provider will maintain a current list of material sub-processors and will provide reasonable notice of material changes where required by law. The Customer may object on reasonable data-protection grounds. The Provider will impose appropriate data protection obligations on sub-processors and remains responsible for their performance to the extent required by applicable law.",
          "A current list of material sub-processors is published at https://projectplanner.us.",
        ],
      },
      {
        title: "9. International Transfers",
        paragraphs: [
          "Where personal data is transferred outside the UK, the Provider will use a lawful transfer mechanism and appropriate safeguards required by applicable UK data protection law. The Provider may use UK adequacy regulations, the UK International Data Transfer Agreement, the UK Addendum to EU Standard Contractual Clauses, or another lawful mechanism where applicable.",
        ],
      },
      {
        title: "10. Data Subject Rights",
        paragraphs: [
          "Taking account of the nature of the processing, the Provider will reasonably assist the Customer with requests from data subjects to exercise applicable rights, including access, rectification, erasure, restriction, objection and portability where applicable. The Customer remains responsible for responding to data subjects unless the law provides otherwise.",
        ],
      },
      {
        title: "11. Personal Data Breaches",
        paragraphs: [
          "The Provider will notify the Customer without undue delay after becoming aware of a personal data breach affecting Customer personal data and will provide information reasonably available to assist the Customer with its regulatory and data-subject obligations.",
        ],
      },
      {
        title: "12. DPIAs and Regulatory Assistance",
        paragraphs: [
          "Taking account of the nature of processing and information available to it, the Provider will reasonably assist the Customer with data protection impact assessments, consultations with the ICO and other compliance obligations that arise from the Provider’s processing of Customer personal data.",
        ],
      },
      {
        title: "13. Audits and Compliance Information",
        paragraphs: [
          "The Provider will make available information reasonably necessary to demonstrate compliance with the data processing obligations in this DPA. The Customer may request reasonable compliance information and, where legally required, conduct an audit on reasonable notice, provided the audit does not compromise the security or confidentiality of other customers or the Platform. Unless required because of a suspected breach, the Customer will bear its own audit costs.",
        ],
      },
      {
        title: "14. Deletion and Return",
        paragraphs: [
          "At the Customer’s choice, the Provider will delete or return Customer personal data at the end of the service, unless applicable law requires continued storage. The Provider may retain limited copies in secure backups for a reasonable backup cycle where immediate deletion is not technically practicable, provided the data is protected and not actively processed for operational purposes.",
        ],
      },
      {
        title: "15. Processing Details",
        paragraphs: [
          "The processing described in this DPA is intended to satisfy the contract requirements applicable to controller-processor relationships under UK data protection law, including requirements concerning the subject matter and duration, nature and purpose, categories of data and data subjects, confidentiality, security, sub-processors, assistance with rights, breach assistance, deletion/return and audits.",
        ],
      },
    ],
  },
  {
    id: "aup",
    title: "Acceptable Use Policy",
    intro: "This Acceptable Use Policy applies to use of ProjectPlanner and forms part of the SaaS Agreement.",
    acceptLabel: "I agree to the ProjectPlanner Acceptable Use Policy",
    acknowledgeOnly: false,
    sections: [
      {
        title: "1. Permitted Use",
        paragraphs: [
          "Customers may use ProjectPlanner for legitimate business purposes connected with construction, project management, maintenance, engineering, property or related activities, subject to the Subscription and SaaS Agreement.",
        ],
      },
      {
        title: "2. Prohibited Conduct",
        paragraphs: [
          "Users must not:",
        ],
        bullets: [
          "use the Platform for unlawful, fraudulent or harmful activity",
          "upload malware, ransomware, malicious code or content designed to compromise systems",
          "attempt to gain unauthorised access to another account, system or environment",
          "probe, scan or test the Platform for vulnerabilities without written permission",
          "interfere with or disrupt the Platform or its infrastructure",
          "circumvent user, storage, technical or security restrictions",
          "reverse engineer, decompile or disassemble the Platform except where expressly permitted by law",
          "scrape or systematically extract Platform data except through functionality expressly provided for that purpose",
          "use the Platform to infringe intellectual property, privacy, confidentiality or other rights",
          "upload data that the Customer is not entitled to process or disclose",
          "use another person’s credentials without authorisation; or",
          "use the Platform to develop or operate a directly competing service through unauthorised copying, extraction or reverse engineering.",
        ],
      },
      {
        title: "3. Content and Customer Responsibility",
        paragraphs: [
          "The Customer remains responsible for Customer Data and for ensuring that uploaded content is lawful, accurate where necessary, and appropriate for the intended project purpose. ProjectPlanner should not be used as the sole repository for critical information where the Customer has a separate contractual or legal obligation to maintain an independent record.",
        ],
      },
      {
        title: "4. Security and Credentials",
        paragraphs: [
          "Users must keep passwords and authentication details confidential, use reasonable security measures, and promptly notify the Provider of suspected unauthorised access. The Customer should remove access promptly when a user leaves the organisation or no longer needs access.",
        ],
      },
      {
        title: "5. Enforcement",
        paragraphs: [
          "The Provider may investigate suspected misuse and may suspend or restrict access where reasonably necessary to protect the Platform, users, personal data or third parties. Where practicable, the Provider will notify the Customer and give an opportunity to remedy the issue. Serious or repeated breaches may result in termination under the SaaS Agreement.",
        ],
      },
      {
        title: "6. Reporting",
        paragraphs: [
          "Suspected security issues, abuse or unlawful use should be reported to info@projectplanner.us. Reports should include enough information for the Provider to investigate.",
        ],
      },
    ],
  },
  {
    id: "privacy",
    title: "Privacy Policy",
    intro: "This Privacy Policy explains how ProjectPlanner Systems Ltd trading as ProjectPlanner handles personal information in connection with the ProjectPlanner website, platform, accounts, support and business relationship.",
    acceptLabel: "I acknowledge that I have been provided with the ProjectPlanner Privacy Policy",
    acknowledgeOnly: true,
    sections: [
      {
        title: "1. Who We Are",
        paragraphs: [
          "Data controller for ProjectPlanner’s own business and website processing: ProjectPlanner Systems Ltd, 71-75 Shelton Street, Covent Garden, London, United Kingdom, WC2H 9JQ. Contact: info@projectplanner.us. If you have questions about personal information, contact us using the details above.",
        ],
      },
      {
        title: "2. Information We Collect",
        paragraphs: [
          "We may collect:",
        ],
        bullets: [
          "account and identity information such as name, work email address, telephone number, job title and company",
          "billing and transaction information",
          "login, authentication and security information",
          "support requests and communications",
          "information about use of the website and Platform, including technical logs, device/browser information and IP address",
          "Customer Data stored by customers in the Platform, which we generally process as a processor on the customer’s instructions rather than as our own controller.",
        ],
      },
      {
        title: "3. How We Use Personal Information",
        paragraphs: [
          "We may use personal information to:",
        ],
        bullets: [
          "create and administer accounts",
          "provide, maintain, secure and improve the Platform",
          "provide customer support",
          "process payments and manage subscriptions",
          "communicate service notices and important account information",
          "detect, prevent and investigate fraud, misuse, security incidents and technical problems",
          "comply with legal obligations",
          "maintain business records and protect our legal rights; and",
          "where permitted by law, send relevant business marketing communications, with appropriate opt-out controls.",
        ],
      },
      {
        title: "4. Lawful Bases",
        paragraphs: [
          "Depending on the circumstances, we rely on contractual necessity, legal obligations, legitimate interests, or consent where consent is required. Where we process Customer Data on behalf of a customer, the customer generally determines the lawful basis and purpose of that processing, and our processing is governed by the DPA.",
        ],
      },
      {
        title: "5. Sharing Personal Information",
        paragraphs: [
          "We may share personal information with service providers that help us operate ProjectPlanner, such as hosting, infrastructure, authentication, email, payment, analytics, security, support and professional service providers. We may also disclose information where required by law, to protect rights or safety, or in connection with a business sale, restructuring or financing, subject to applicable law.",
        ],
      },
      {
        title: "6. International Transfers",
        paragraphs: [
          "Some service providers may process information outside the UK. Where this occurs, we will use a lawful transfer mechanism and appropriate safeguards required by applicable data protection law.",
        ],
      },
      {
        title: "7. Retention",
        paragraphs: [
          "We keep personal information only for as long as reasonably necessary for the purposes described in this Policy, including to provide services, maintain business and financial records, resolve disputes, enforce agreements and comply with legal obligations. Retention periods vary according to the type of information and purpose. Product usage events and sessions are kept for 13 months. Unfinished organisation set-ups that never activated are reviewed after 12 months and may be deleted.",
        ],
      },
      {
        title: "8. Your Rights",
        paragraphs: [
          "Subject to applicable law, individuals may have rights including access, rectification, erasure, restriction, objection, data portability and the right to withdraw consent where processing relies on consent. To exercise a right, contact info@projectplanner.us. We may need to verify identity before responding.",
        ],
      },
      {
        title: "9. Complaints",
        paragraphs: [
          "If you have a concern about how we use personal information, contact us first so that we can investigate and try to resolve it. You may also complain to the Information Commissioner’s Office (ICO) where applicable.",
        ],
      },
      {
        title: "10. Cookies and Similar Technologies",
        paragraphs: [
          "The ProjectPlanner website and Platform may use cookies or similar technologies that are necessary for authentication, security, functionality and preferences, and may use analytics or other technologies where permitted or where consent is required. A separate cookie notice may be provided where appropriate.",
        ],
      },
      {
        title: "11. Changes to this Policy",
        paragraphs: [
          "We may update this Privacy Policy to reflect changes in law, technology, services or our processing activities. The latest version will be published on the ProjectPlanner website and will show its effective date.",
        ],
      },
      {
        title: "12. Product analytics and public statistics",
        paragraphs: [
          "We record product usage events (for example that a page was opened or a timesheet was signed) so the platform owner can operate and improve Project Planner. Those events store identifiers, categories and paths — not names, emails or free-text notes.",
          "We may publish anonymised, aggregated platform statistics (for example total hours or timesheet value processed). These never identify you or your organisation. Figures are rounded down and are not published from fewer than five real organisations.",
          "The platform owner’s console can access organisation and user records needed for support, security and billing. Login emails in that console are masked until revealed, and reveals are audited.",
        ],
      },
    ],
  },
]

export function legalDocumentById(id: LegalDocumentId): LegalDocument {
  const found = LEGAL_PACK_DOCUMENTS.find((doc) => doc.id === id)
  if (!found) throw new Error(`Unknown legal document: ${id}`)
  return found
}

