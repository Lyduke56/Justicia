'use server';

/**
 * AI Legal Assistant conversation history (new code only; /api/ai/chat is unchanged).
 *
 * The chat screen asks /api/ai/chat for an answer as before, then saves the question and the
 * answer here. Every action re-checks the session and only touches the caller's own
 * conversations. Storage: `conversations` + `messages` (see src/lib/ai/history.ts); account
 * deletion already removes both (src/lib/account/deletion.ts).
 */
import { requireActiveAccount, guardMessage, UUID_RE } from '@/lib/auth/guards';
import { checkRateLimit } from '@/lib/security/rateLimit';
import {
  AI_HISTORY_LIMIT,
  AI_TITLE_MAX,
  type AiCitation,
  type AiConversationSummary,
  type AiExchangeInput,
  type AiMessageMeta,
  type AiStoredMessage,
  type AiSuggestedFilters,
} from '@/lib/ai/history';

const MAX_USER_CHARS = 8000;
const MAX_ASSISTANT_CHARS = 40000;
const MAX_MESSAGES_LOADED = 500;
const MAX_CITATIONS = 12;
/** Client clocks are trusted only within this window; anything else uses the server time. */
const MAX_CLOCK_SKEW_MS = 6 * 60 * 60 * 1000;

type Db = Awaited<ReturnType<typeof requireActiveAccount>>['db'];

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function titleFrom(question: string): string {
  const flat = question.replace(/\s+/g, ' ').trim();
  if (!flat) return 'New legal question';
  return flat.length > AI_TITLE_MAX ? `${flat.slice(0, AI_TITLE_MAX - 1).trimEnd()}…` : flat;
}

function cleanCitations(v: unknown): AiCitation[] {
  if (!Array.isArray(v)) return [];
  return v
    .slice(0, MAX_CITATIONS)
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object')
    .map((c) => ({ sourceId: str(c.sourceId, 120), title: str(c.title, 300), citation: str(c.citation, 120) }))
    .filter((c) => c.title || c.citation);
}

function cleanFilters(v: unknown): AiSuggestedFilters | null {
  if (!v || typeof v !== 'object') return null;
  const f = v as Record<string, unknown>;
  const out: AiSuggestedFilters = {};
  for (const key of ['specialization', 'chapter', 'lang', 'fee', 'sort'] as const) {
    const value = str(f[key], 80).trim();
    if (value) out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

/** A client timestamp if it is plausible, otherwise now. */
function clampTime(v: unknown, now: number): number {
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t > now + 60_000 || t < now - MAX_CLOCK_SKEW_MS) return now;
  return Math.min(t, now);
}

function readMeta(raw: unknown): AiMessageMeta {
  const ai = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as { ai?: unknown }).ai : null;
  if (!ai || typeof ai !== 'object') return {};
  const m = ai as Record<string, unknown>;
  return {
    citations: cleanCitations(m.citations),
    escalate: m.escalate === true,
    offTopic: m.offTopic === true,
    suggestedFilters: cleanFilters(m.suggestedFilters),
    ...(typeof m.attachedFileName === 'string' && m.attachedFileName ? { attachedFileName: m.attachedFileName } : {}),
  };
}

/** The conversation if the caller owns it. */
async function ownedConversation(db: Db, userId: string, conversationId: unknown) {
  if (typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) return null;
  const { data } = await db
    .from('conversations')
    .select('id, user_id, title, updated_at')
    .eq('id', conversationId)
    .maybeSingle();
  return data && data.user_id === userId ? (data as { id: string; user_id: string; title: string | null; updated_at: string }) : null;
}

/** The caller's AI conversations, most recent first. */
export async function listAiConversationsAction(): Promise<{ conversations: AiConversationSummary[] } | { error: string }> {
  try {
    const { user, db } = await requireActiveAccount();
    const { data, error } = await db
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(AI_HISTORY_LIMIT);
    if (error) {
      console.error('[listAiConversationsAction]', error.message);
      return { error: 'Your conversation history could not be loaded.' };
    }
    return {
      conversations: (data ?? []).map((c: { id: string; title: string | null; updated_at: string }) => ({
        id: c.id,
        title: c.title?.trim() || 'New legal question',
        updatedAt: c.updated_at,
      })),
    };
  } catch (err) {
    return { error: guardMessage(err) };
  }
}

/** Every message of one of the caller's conversations, oldest first. */
export async function getAiConversationAction(
  conversationId: string
): Promise<{ conversation: AiConversationSummary; messages: AiStoredMessage[] } | { error: string }> {
  try {
    const { user, db } = await requireActiveAccount();
    const conv = await ownedConversation(db, user.id, conversationId);
    if (!conv) return { error: 'This conversation could not be found.' };

    const { data, error } = await db
      .from('messages')
      .select('id, role, content, citations, sent_at')
      .eq('conversation_or_thread_id', conv.id)
      .in('role', ['user', 'assistant'])
      .order('sent_at', { ascending: true })
      .limit(MAX_MESSAGES_LOADED);
    if (error) {
      console.error('[getAiConversationAction]', error.message);
      return { error: 'This conversation could not be loaded.' };
    }

    return {
      conversation: { id: conv.id, title: conv.title?.trim() || 'New legal question', updatedAt: conv.updated_at },
      messages: (data ?? []).map((m: { id: string; role: string; content: string; citations: unknown; sent_at: string }) => ({
        id: m.id,
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
        sentAt: m.sent_at,
        ...readMeta(m.citations),
      })),
    };
  } catch (err) {
    return { error: guardMessage(err) };
  }
}

/**
 * Saves one question and its answer. Starts a new conversation (titled from the question) when
 * `conversationId` is null, and returns the conversation id to use for the next exchange.
 */
export async function saveAiExchangeAction(input: AiExchangeInput): Promise<{ conversationId: string } | { error: string }> {
  try {
    const { user, db } = await requireActiveAccount();
    const limited = await checkRateLimit('message_send', user.id);
    if (limited) return { error: limited };

    const question = str(input?.user?.content, MAX_USER_CHARS).trim();
    const answer = str(input?.assistant?.content, MAX_ASSISTANT_CHARS).trim();
    if (!question || !answer) return { error: 'Nothing to save.' };

    const now = Date.now();
    const askedAt = clampTime(input.user.sentAt, now);
    // The answer always sorts after its question, even when both land in the same millisecond.
    const answeredAt = Math.max(clampTime(input.assistant.sentAt, now), askedAt + 1);

    let conversationId: string;
    let created = false;
    if (input.conversationId) {
      const conv = await ownedConversation(db, user.id, input.conversationId);
      if (!conv) return { error: 'This conversation could not be found.' };
      conversationId = conv.id;
    } else {
      const { data, error } = await db
        .from('conversations')
        .insert({ user_id: user.id, title: titleFrom(question), created_at: new Date(askedAt).toISOString(), updated_at: new Date(answeredAt).toISOString() })
        .select('id')
        .single();
      if (error || !data) {
        console.error('[saveAiExchangeAction] conversation insert failed:', error?.message);
        return { error: 'This conversation could not be saved.' };
      }
      conversationId = data.id as string;
      created = true;
    }

    const fileName = str(input.user.attachedFileName, 255).trim();
    const assistantMeta: AiMessageMeta = {
      citations: cleanCitations(input.assistant.citations),
      escalate: input.assistant.escalate === true,
      offTopic: input.assistant.offTopic === true,
      suggestedFilters: cleanFilters(input.assistant.suggestedFilters),
    };

    const { error: msgError } = await db.from('messages').insert([
      {
        conversation_or_thread_id: conversationId,
        sender_id: user.id,
        role: 'user',
        content: question,
        attachment_ids: [],
        citations: fileName ? { ai: { attachedFileName: fileName } } : null,
        sent_at: new Date(askedAt).toISOString(),
      },
      {
        conversation_or_thread_id: conversationId,
        sender_id: user.id,
        role: 'assistant',
        content: answer,
        attachment_ids: [],
        citations: { ai: assistantMeta },
        sent_at: new Date(answeredAt).toISOString(),
      },
    ]);
    if (msgError) {
      console.error('[saveAiExchangeAction] message insert failed:', msgError.message);
      if (created) await db.from('conversations').delete().eq('id', conversationId).eq('user_id', user.id);
      return { error: 'This conversation could not be saved.' };
    }

    if (!created) {
      await db
        .from('conversations')
        .update({ updated_at: new Date(answeredAt).toISOString() })
        .eq('id', conversationId)
        .eq('user_id', user.id);
    }
    return { conversationId };
  } catch (err) {
    return { error: guardMessage(err) };
  }
}

/** Deletes one of the caller's conversations and its messages. */
export async function deleteAiConversationAction(conversationId: string): Promise<{ success: true } | { error: string }> {
  try {
    const { user, db } = await requireActiveAccount();
    const conv = await ownedConversation(db, user.id, conversationId);
    if (!conv) return { error: 'This conversation could not be found.' };

    const { error: msgError } = await db.from('messages').delete().eq('conversation_or_thread_id', conv.id);
    if (msgError) {
      console.error('[deleteAiConversationAction] message delete failed:', msgError.message);
      return { error: 'This conversation could not be deleted.' };
    }
    const { error } = await db.from('conversations').delete().eq('id', conv.id).eq('user_id', user.id);
    if (error) {
      console.error('[deleteAiConversationAction] conversation delete failed:', error.message);
      return { error: 'This conversation could not be deleted.' };
    }
    return { success: true };
  } catch (err) {
    return { error: guardMessage(err) };
  }
}
