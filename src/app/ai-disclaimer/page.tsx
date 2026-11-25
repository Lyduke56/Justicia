import type { Metadata } from 'next';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'AI Disclaimer | Justicia' };

export default function AiDisclaimerPage() {
  return (
    <LegalPage
      title="AI Disclaimer"
      intro="Justicia’s AI assistant helps you understand Philippine law in general terms. Please read this before relying on any answer."
    >
      <section>
        <h2>Not legal advice</h2>
        <p>
          The AI assistant gives general legal information, not legal advice for your situation. Using it does not create a
          lawyer–client relationship. For advice on your specific case, book a consultation with a verified lawyer.
        </p>
      </section>
      <section>
        <h2>Answers can be wrong</h2>
        <ul>
          <li>The assistant can misunderstand a question, miss recent changes in the law, or cite a source incorrectly.</li>
          <li>Check important points against the cited laws and decisions, or ask a lawyer.</li>
          <li>Deadlines (for example for filing a case or an appeal) can be strict; do not rely on the assistant for them.</li>
        </ul>
      </section>
      <section>
        <h2>Urgent situations</h2>
        <p>If you are in danger or facing an emergency, contact the police (911) or the appropriate authority right away instead of the assistant.</p>
      </section>
      <section>
        <h2>What you share</h2>
        <p>Avoid sharing more personal or confidential details than you need to ask your question. See the Privacy Policy for how questions are handled.</p>
      </section>
    </LegalPage>
  );
}
