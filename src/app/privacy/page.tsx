import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy Policy | Justicia' };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal data Justicia collects, why, and the rights you have under the Data Privacy Act of 2012 (Republic Act No. 10173)."
    >
      <section>
        <h2>What we collect</h2>
        <ul>
          <li><strong>Account details:</strong> name, email address, phone number (optional), and your role (client, lawyer or administrator).</li>
          <li><strong>Profile details you choose to add:</strong> photo, city or province, preferred language, and how and when you prefer to be contacted.</li>
          <li><strong>Consultations:</strong> the requests you make or receive, schedules, messages, shared documents and proof of payment.</li>
          <li><strong>Lawyer verification:</strong> roll number, IBP chapter and the proof documents lawyers upload. Only the Justicia review team can open these files.</li>
          <li><strong>Security records:</strong> sign-in times, consent dates, and an audit log of sensitive actions.</li>
        </ul>
      </section>
      <section>
        <h2>Why we use it</h2>
        <ul>
          <li>To run your account, bookings, messaging and payments.</li>
          <li>To verify lawyers and keep the directory trustworthy.</li>
          <li>To keep the platform safe: preventing abuse, handling reports and meeting legal obligations.</li>
        </ul>
        <p>We do not sell your personal data. Questions to the AI assistant are processed to generate answers and are not used to profile you.</p>
      </section>
      <section>
        <h2>Who can see it</h2>
        <ul>
          <li>A lawyer you book sees your name, the details you share for that consultation, and your contact preferences.</li>
          <li>Clients see a verified lawyer’s public profile only.</li>
          <li>Justicia administrators see what they need to verify lawyers, handle reports and keep accounts secure; their access is logged.</li>
          <li>Our service providers (database hosting, email delivery, AI processing) process data only on our instructions.</li>
        </ul>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <p>
          We keep your data while your account is active. When you delete your account, your personal data is erased after a 7-day undo
          window. Records other people rely on, such as a consultation or payment you were part of, remain without your name, email or
          phone. If an account was suspended or terminated, a one-way hash of its email address is kept so it cannot be used to register
          again.
        </p>
      </section>
      <section>
        <h2>Your rights</h2>
        <ul>
          <li><strong>Access and portability:</strong> download a copy of your data from Settings → Download my data.</li>
          <li><strong>Correction:</strong> update your profile at any time.</li>
          <li><strong>Erasure:</strong> delete your account from Settings.</li>
          <li><strong>Objection and complaints:</strong> contact us, or the National Privacy Commission (privacy.gov.ph).</li>
        </ul>
      </section>
      <section>
        <h2>Security</h2>
        <p>
          Files are stored privately and opened only through short-lived links. Access rules in our database limit each user to their
          own records, sessions end after inactivity, and you can sign out of every device at once.
        </p>
      </section>
    </LegalPage>
  );
}
