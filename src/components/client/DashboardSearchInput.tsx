'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SendPaperPlaneIcon } from './ClientIcons';

export function DashboardSearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/client/ai-assistant?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative flex items-center w-full rounded-2xl bg-[#E4D7C5] shadow-[inset_2px_2px_5px_rgba(0,0,0,0.12),inset_-2px_-2px_5px_rgba(255,255,255,0.7)] px-4 sm:px-5 py-3 transition-all focus-within:ring-2 focus-within:ring-[#C58B3C]/50">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a legal question"
          className="w-full bg-transparent text-[#34150F] placeholder-[#8C7A6B] text-sm sm:text-base focus:outline-none pr-10 font-normal"
        />
        <button
          type="submit"
          disabled={!query.trim()}
          className="absolute right-3.5 p-2 rounded-xl text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-40 transition-colors focus:outline-none"
          aria-label="Send legal question"
        >
          <SendPaperPlaneIcon className="w-5 h-5 sm:w-5 sm:h-5" />
        </button>
      </div>
    </form>
  );
}
