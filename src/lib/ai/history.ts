/**
 * AI Legal Assistant conversation history: shared types (safe for client and server).
 *
 * Storage reuses the original AI tables from 0001_init: `conversations` (one row per chat, owned
 * by `user_id`) and `messages` (`conversation_or_thread_id` = the conversation id, `role` =
 * user | assistant, `sender_id` = the owner for both roles). The extra answer details the chat
 * screen shows (citations, the Find a Lawyer suggestion, the off-topic notice, the attached
 * file's name) are kept in the message's `citations` jsonb under `ai`.
 */

export interface AiCitation {
  sourceId: string;
  title: string;
  citation: string;
}

export interface AiSuggestedFilters {
  specialization?: string;
  chapter?: string;
  lang?: string;
  fee?: string;
  sort?: string;
}

/** What is stored in `messages.citations` for an AI conversation message. */
export interface AiMessageMeta {
  citations?: AiCitation[];
  escalate?: boolean;
  offTopic?: boolean;
  suggestedFilters?: AiSuggestedFilters | null;
  attachedFileName?: string;
}

export interface AiStoredMessage extends AiMessageMeta {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** ISO timestamp. */
  sentAt: string;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  /** ISO timestamp of the last exchange. */
  updatedAt: string;
}

/** One question and the answer shown for it, saved together after the answer arrives. */
export interface AiExchangeInput {
  /** null starts a new conversation. */
  conversationId: string | null;
  user: { content: string; sentAt: string; attachedFileName?: string };
  assistant: { content: string; sentAt: string } & Omit<AiMessageMeta, 'attachedFileName'>;
}

export const AI_TITLE_MAX = 80;
export const AI_HISTORY_LIMIT = 50;
