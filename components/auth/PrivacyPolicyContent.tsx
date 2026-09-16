/**
 * iOS parity source: Views/PrivacyPolicyView.swift
 * Spec: docs/ios-parity/02-navigation-map.md screen 4
 */

const SECTIONS: { title: string; body: string; bullets?: string[] }[] = [
  {
    title: '1. Introduction',
    body: "Project Planner ('we', 'our', or 'us') is committed to protecting your privacy and personal data. This Privacy Policy explains how we collect, use, store, and protect your personal information in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
  },
  {
    title: '2. Data Controller',
    body: 'Project Planner is the data controller for the personal data we process. If you have any questions about this policy or our data practices, please contact us.',
  },
  {
    title: '3. Information We Collect',
    body: 'We collect the following types of personal data:',
    bullets: [
      'Name, email address, and contact information',
      'Mobile phone number (if provided)',
      'Job role, permissions, and access levels',
      'Project and task information',
      'Booking and scheduling data',
      'Qualifications and work history',
      'Client and project details',
      'Images and files uploaded in relation to tasks',
      'Location data for project sites',
    ],
  },
  {
    title: '4. How We Use Your Data',
    body: 'We use your personal data for the following purposes:',
    bullets: [
      'To provide and manage the Project Planner service',
      'To assign tasks and schedule work',
      'To communicate with you about projects and tasks',
      'To manage user accounts and permissions',
      'To generate reports and analytics',
      'To comply with legal obligations',
      'To improve our services',
    ],
  },
  {
    title: '5. Legal Basis for Processing',
    body: 'We process your personal data under the following legal bases:',
    bullets: [
      'Contract: To fulfill our service agreement with your organization',
      'Legitimate Interest: To manage projects, tasks, and operations efficiently',
      'Consent: Where you have provided explicit consent (e.g., for notifications)',
      'Legal Obligation: To comply with applicable laws and regulations',
    ],
  },
  {
    title: '6. Data Storage and Security',
    body: 'Your data is stored securely using:',
    bullets: [
      'Firebase (Google Cloud Platform) for data storage',
      'Encrypted data transmission (HTTPS/TLS)',
      'Access controls and authentication',
      'Regular security updates and monitoring',
    ],
  },
  {
    title: '7. Data Sharing',
    body: 'We may share your data with:',
    bullets: [
      'Other users within your organization (based on permissions)',
      'Service providers (e.g., Firebase, email services) who assist in operating the app',
      'Legal authorities if required by law',
    ],
  },
  {
    title: '8. Your Rights Under UK GDPR',
    body: 'You have the following rights:',
    bullets: [
      'Right of Access: Request a copy of your personal data',
      'Right to Rectification: Correct inaccurate data',
      'Right to Erasure: Request deletion of your data (subject to legal requirements)',
      'Right to Restrict Processing: Limit how we use your data',
      'Right to Data Portability: Receive your data in a portable format',
      'Right to Object: Object to certain types of processing',
      'Rights Related to Automated Decision Making: Not applicable to our service',
    ],
  },
  {
    title: '9. Data Retention',
    body: 'We retain your personal data for as long as necessary to provide our services and comply with legal obligations. When you leave an organization or your account is deleted, we will delete or anonymize your personal data within 30 days, unless we are required to retain it for legal purposes.',
  },
  {
    title: '10. Cookies and Tracking',
    body: 'Project Planner uses essential cookies and local storage to maintain your session and preferences. We do not use third-party tracking cookies or advertising trackers.',
  },
  {
    title: '11. International Data Transfers',
    body: 'Your data may be processed outside the UK/EEA by our service providers (e.g., Firebase/Google Cloud). We ensure appropriate safeguards are in place, including Standard Contractual Clauses and adequacy decisions.',
  },
  {
    title: "12. Children's Data",
    body: 'Project Planner is intended for business use and is not directed at individuals under 18 years of age. We do not knowingly collect personal data from children.',
  },
  {
    title: '13. Changes to This Policy',
    body: "We may update this Privacy Policy from time to time. We will notify you of significant changes and update the 'Last Updated' date. Continued use of the app after changes constitutes acceptance of the updated policy.",
  },
  {
    title: '14. Contact Us',
    body: 'If you have questions about this Privacy Policy or wish to exercise your rights, please contact:\n\nYour Organization Administrator\n\nOr the Project Planner support team.',
  },
]

export function PrivacyPolicyContent({
  acceptanceRequired,
  onAccept,
  accepting,
}: {
  acceptanceRequired?: boolean
  onAccept?: () => void
  accepting?: boolean
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-5 py-8">
      <header>
        <h1 className="text-[28px] font-semibold tracking-tight text-ios-ink lg:text-[32px]">
          Privacy Policy & Data Protection
        </h1>
        <p className="mt-2 text-sm text-ios-muted">Last Updated: December 2025</p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-ios-ink">{section.title}</h2>
          <p className="whitespace-pre-line text-[16px] leading-relaxed text-ios-ink">{section.body}</p>
          {section.bullets ? (
            <ul className="space-y-1.5 pl-1 text-[16px] text-ios-ink">
              {section.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <span>•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {section.title.startsWith('6.') ? (
            <p className="pt-2 text-[16px] leading-relaxed text-ios-ink">
              Data is stored within the European Economic Area (EEA) or in jurisdictions with adequate data protection
              laws.
            </p>
          ) : null}
          {section.title.startsWith('7.') ? (
            <p className="pt-2 text-[16px] leading-relaxed text-ios-ink">We do not sell your personal data to third parties.</p>
          ) : null}
          {section.title.startsWith('8.') ? (
            <p className="pt-2 text-[16px] leading-relaxed text-ios-ink">
              To exercise these rights, please contact your organization&apos;s administrator or contact us directly.
            </p>
          ) : null}
        </section>
      ))}
      {acceptanceRequired ? (
        <button
          type="button"
          onClick={onAccept}
          disabled={accepting}
          className="w-full rounded-xl bg-[#185FA5] px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {accepting ? 'Saving acceptance…' : 'I Accept'}
        </button>
      ) : null}
    </div>
  )
}
