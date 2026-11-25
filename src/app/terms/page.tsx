import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms of Service | Justicia' };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of Justicia, a platform that offers general Philippine legal information and connects clients with verified lawyers for consultations. By creating an account you agree to them."
    >
      <section>
        <h2>1. What Justicia is, and is not</h2>
        <p>
          Justicia provides legal information, an AI assistant and a directory of lawyers whose credentials our team has checked.
          Justicia itself is not a law firm and does not give legal advice. A lawyer–client relationship exists only between you
          and the lawyer you consult, and the lawyer is responsible for the advice they give.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>Give accurate information and keep your password private. One account per email address.</li>
          <li>You are responsible for what happens under your account. Use “Sign out everywhere” in Settings if you think someone else has access.</li>
          <li>You can download your data or delete your account at any time from Settings. Deletion can be undone for 7 days.</li>
        </ul>
      </section>
      <section>
        <h2>3. Lawyers</h2>
        <ul>
          <li>Lawyers must be members in good standing of the Integrated Bar of the Philippines and must upload proof of bar admission, IBP membership and identity.</li>
          <li>Lawyers set their own fees, must keep client information confidential, and must follow the Code of Professional Responsibility and Accountability.</li>
          <li>Justicia may revoke a lawyer’s verification if the credentials can no longer be confirmed.</li>
        </ul>
      </section>
      <section>
        <h2>4. Consultations and payments</h2>
        <ul>
          <li>A booking is a request until the lawyer approves it and confirms your proof of payment.</li>
          <li>Pay only through the payment channel shown in Justicia. Report any request to pay outside the platform.</li>
          <li>Consultations cancelled by Justicia (for example after an account suspension) are refunded.</li>
        </ul>
      </section>
      <section>
        <h2>5. Acceptable use</h2>
        <p>
          Do not harass, deceive or threaten other users, impersonate anyone, share unlawful content, or try to get around the
          platform’s security. Reports are reviewed by our team.
        </p>
      </section>
      <section>
        <h2>6. Suspension and termination</h2>
        <p>
          We may suspend or terminate accounts that break these terms. You will be told why, and you can contact support if you think the
          decision is wrong. The email address of a suspended or terminated account cannot be used to register again.
        </p>
      </section>
      <section>
        <h2>7. Liability</h2>
        <p>
          Justicia is provided as is. To the extent the law allows, Justicia is not liable for the outcome of any legal matter or for
          advice given by lawyers on the platform. Nothing in these terms limits rights you have under Philippine law.
        </p>
      </section>
      <section>
        <h2>8. Changes and governing law</h2>
        <p>
          We will tell you in the app when these terms change materially. These terms are governed by the laws of the Republic of the
          Philippines.
        </p>
      </section>
    </LegalPage>
  );
}
