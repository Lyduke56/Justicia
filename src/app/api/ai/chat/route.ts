import { type NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const PHILIPPINE_LEGAL_SYSTEM_PROMPT = `You are Justicia AI, an expert Philippine legal intelligence assistant.
Your role is to assist Filipinos and legal practitioners with accurate, accessible, and structured Philippine legal information.

Rules & Guidelines:
1. Ground your answers strictly on Philippine laws, including:
   - The 1987 Constitution of the Republic of the Philippines
   - Civil Code of the Philippines (Republic Act No. 386)
   - Revised Penal Code (Act No. 3815 as amended)
   - Labor Code of the Philippines (Presidential Decree No. 442 as amended)
   - Family Code of the Philippines (Executive Order No. 209)
   - Rules of Court (including Rules on Small Claims, Expedited Rules, Rules of Civil and Criminal Procedure)
   - Pertinent Republic Acts and landmark Supreme Court Jurisprudence (En Banc / Division rulings).
2. Format:
   - Provide a direct, compassionate, and clear legal explanation.
   - Specifically cite Articles, Sections, or Supreme Court G.R. numbers where applicable.
   - Mention actionable remedies (e.g., filing with DOLE/NLRC for labor, barangay conciliation under KP Law if applicable, filing with MTC/RTC).
   - Flag whether the situation requires formal representation by a licensed member of the Integrated Bar of the Philippines (IBP).
3. Always maintain professionalism and clarity.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const messages: Message[] = body.messages || [];

    if (!messages.length) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const latestUserMessage = messages[messages.length - 1].content;
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });

        // Build conversational contents
        const contents = messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction: PHILIPPINE_LEGAL_SYSTEM_PROMPT,
            temperature: 0.25,
          },
        });

        const generatedText = response.text || '';

        // Extract citations dynamically from the response
        const citations = extractPhilippineCitations(generatedText, latestUserMessage);
        const shouldEscalate = checkEscalationNeeds(generatedText, latestUserMessage);

        return NextResponse.json({
          text: generatedText,
          citations,
          escalate: shouldEscalate,
        });
      } catch (geminiError: unknown) {
        console.error('[Gemini API Error]', geminiError);
        // Fall back to knowledge base answer below
      }
    }

    // Knowledge-base powered fallback if API key is not yet set
    const fallbackResponse = generateLocalLegalResponse(latestUserMessage);
    return NextResponse.json(fallbackResponse);
  } catch (err: unknown) {
    console.error('Chat API Error:', err);
    return NextResponse.json(
      { error: 'Failed to process legal question' },
      { status: 500 }
    );
  }
}

function extractPhilippineCitations(text: string, query: string) {
  const citations = [];
  const lower = (text + ' ' + query).toLowerCase();

  if (lower.includes('labor') || lower.includes('dismissal') || lower.includes('dole') || lower.includes('nlrc') || lower.includes('termination')) {
    citations.push({
      sourceId: 'pd-442',
      title: 'Labor Code of the Philippines (Art. 297/298 Just & Authorized Causes)',
      citation: 'PD 442',
    });
  }
  if (lower.includes('contract') || lower.includes('damage') || lower.includes('lease') || lower.includes('obligation') || lower.includes('civil code')) {
    citations.push({
      sourceId: 'ra-386',
      title: 'Civil Code of the Philippines (Book IV — Obligations and Contracts)',
      citation: 'RA 386',
    });
  }
  if (lower.includes('marriage') || lower.includes('annulment') || lower.includes('custody') || lower.includes('support') || lower.includes('family')) {
    citations.push({
      sourceId: 'eo-209',
      title: 'Family Code of the Philippines (EO 209)',
      citation: 'EO 209',
    });
  }
  if (lower.includes('criminal') || lower.includes('theft') || lower.includes('estafa') || lower.includes('libel') || lower.includes('cybercrime')) {
    citations.push({
      sourceId: 'act-3815',
      title: 'Revised Penal Code of the Philippines / RA 10175 Cybercrime Prevention Act',
      citation: 'Act 3815 / RA 10175',
    });
  }
  if (lower.includes('small claim') || lower.includes('debt') || lower.includes('collection') || lower.includes('mtc')) {
    citations.push({
      sourceId: 'am-08-8-7-sc',
      title: 'Revised Rules of Procedure for Small Claims Cases (Up to ₱1,000,000)',
      citation: 'A.M. No. 08-8-7-SC',
    });
  }

  if (citations.length === 0) {
    citations.push({
      sourceId: 'consti-1987',
      title: '1987 Philippine Constitution & Supreme Court Jurisprudence',
      citation: '1987 Consti',
    });
  }

  return citations;
}

function checkEscalationNeeds(text: string, query: string): boolean {
  const lower = (text + ' ' + query).toLowerCase();
  const escalationKeywords = [
    'lawyer', 'attorney', 'court', 'filing', 'hearing', 'trial', 'complaint',
    'sue', 'police', 'arrest', 'warrant', 'dismissal', 'dispute', 'estafa', 'notarize'
  ];
  return escalationKeywords.some((kw) => lower.includes(kw));
}

function generateLocalLegalResponse(query: string) {
  const lower = query.toLowerCase();

  if (lower.includes('dismissal') || lower.includes('labor') || lower.includes('fired') || lower.includes('dole')) {
    return {
      text: `Under the **Labor Code of the Philippines (Presidential Decree No. 442 as amended)**, security of tenure is guaranteed under Article 294 (formerly Art. 279). An employee cannot be dismissed except for just or authorized causes.

### Key Legal Standards:
1. **Just Causes (Art. 297):** Serious misconduct, willful disobedience, gross and habitual neglect of duty, fraud, or commission of a crime.
2. **Authorized Causes (Art. 298):** Redundancy, retrenchment to prevent losses, closure of establishment, or disease.
3. **Twin-Notice Requirement (Procedural Due Process):**
   - **First written notice:** Specifying the particular acts or omissions charged with reasonable opportunity to explain.
   - **Hearing/Conference:** Opportunity to respond and present defense.
   - **Second written notice:** Notice of decision to terminate indicating that all circumstances have been evaluated.

If procedural due process is violated even with valid cause, nominal damages are awarded under the *Agabon* doctrine (₱30,000–₱50,000). If both substantive and procedural due process are violated, the dismissal is illegal, entitling the employee to reinstatement and full backwages.`,
      citations: [
        {
          sourceId: 'pd-442-art-297',
          title: 'Labor Code of the Philippines, Articles 297 & 298',
          citation: 'PD 442',
        },
        {
          sourceId: 'sc-agabon',
          title: 'Agabon v. NLRC, G.R. No. 158693 (En Banc)',
          citation: 'G.R. No. 158693',
        },
      ],
      escalate: true,
    };
  }

  if (lower.includes('small claim') || lower.includes('utang') || lower.includes('money') || lower.includes('debt') || lower.includes('loan')) {
    return {
      text: `Under the **Revised Rules of Procedure for Small Claims Cases (A.M. No. 08-8-7-SC, as amended in 2022)**, money claims up to **₱1,000,000.00** before Metropolitan Trial Courts (MeTC), Municipal Trial Courts in Cities (MTCC), and Municipal Trial Courts (MTC) are resolved through a summary, expedited process without formal trial.

### Key Rules:
1. **No Lawyers Allowed in Hearings:** The parties must appear personally. Lawyers are strictly prohibited from representing parties during hearings to ensure accessibility.
2. **One-Day Hearing:** Decisions are rendered on the same day the hearing is held.
3. **Final and Executory:** Decisions in small claims cases are final, executory, and unappealable.
4. **Prerequisite:** Barangay Conciliation (Katarungang Pambarangay) is required if both parties reside in the same city or municipality before filing in court.`,
      citations: [
        {
          sourceId: 'am-08-8-7-sc',
          title: 'Revised Rules of Procedure for Small Claims Cases',
          citation: 'A.M. No. 08-8-7-SC',
        },
        {
          sourceId: 'ra-7160',
          title: 'Local Government Code of 1991 (Katarungang Pambarangay)',
          citation: 'RA 7160 Sec. 399-422',
        },
      ],
      escalate: false,
    };
  }

  return {
    text: `Based on Philippine Jurisprudence and statutory law, every legal inquiry requires determining the governing statutory framework (Civil, Criminal, Administrative, or Labor) and identifying the appropriate remedy.

### General Guidelines:
- **Civil and Contractual Disputes:** Governed by the **Civil Code of the Philippines (Republic Act No. 386)**. Contracts have the force of law between parties (Art. 1159).
- **Conciliation:** Under the Katarungang Pambarangay Law (RA 7160), disputes between individuals residing in the same city or municipality must undergo Barangay Lupon conciliation before court filing.
- **Next Steps:** Please feel free to ask about specific facts, statutory articles, or procedures relevant to your situation.`,
    citations: [
      {
        sourceId: 'ra-386',
        title: 'Civil Code of the Philippines',
        citation: 'RA 386',
      },
      {
        sourceId: 'ra-7160',
        title: 'Local Government Code of 1991 (Katarungang Pambarangay)',
        citation: 'RA 7160',
      },
    ],
    escalate: true,
  };
}
