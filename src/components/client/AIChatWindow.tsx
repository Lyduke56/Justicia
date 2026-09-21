'use client';

/**
 * AIChatWindow — Client-facing component
 * The chat message display and input area for the AI Legal Assistant.
 * TODO: Render message bubbles (user vs AI, with different styles)
 * TODO: Show CitationChip for each citation in AI responses
 * TODO: Show DisclaimerBanner above the chat
 * TODO: Show "Connect with a Lawyer" banner when response.escalate === true
 * TODO: Auto-scroll to latest message
 * TODO: Message input with send button and file attachment
 * TODO: Streaming response support (SSE)
 * TODO: Typing indicator animation
 */

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: { sourceId: string; citation: string; title: string }[];
  escalate?: boolean;
}

interface AIChatWindowProps {
  messages: Message[];
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function AIChatWindow({ messages, onSend, isLoading = false }: AIChatWindowProps) {
  return (
    <div className="flex flex-col h-full" aria-label="AI Legal Assistant chat">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4" role="log" aria-live="polite" aria-label="Chat messages">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            Ask any Philippine legal question to get started.
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.content}
              {/* TODO: Render CitationChip components for citations */}
              {msg.escalate && (
                <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
                  💼 This situation may benefit from professional legal counsel.{' '}
                  <a href="/lawyers" className="underline font-medium">Connect with a Lawyer</a>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-muted px-4 py-3 text-sm">
              {/* TODO: Animated typing indicator */}
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem('message') as HTMLInputElement;
            if (input.value.trim()) {
              onSend(input.value.trim());
              input.value = '';
            }
          }}
          className="flex gap-2"
          aria-label="Send message"
        >
          <input
            name="message"
            type="text"
            placeholder="Ask a legal question…"
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Your message"
            disabled={isLoading}
          />
          <button
            type="submit"
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            disabled={isLoading}
            aria-label="Send message"
          >
            Send
          </button>
        </form>
        {/* TODO: File attachment button */}
      </div>
    </div>
  );
}
