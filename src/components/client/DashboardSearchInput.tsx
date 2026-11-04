'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { SendPaperPlaneIcon } from './ClientIcons';

export function DashboardSearchInput() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isHovered, setIsHovered] = useState(false);

  const hasPrompt = query.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPrompt) return;
    router.push(`/client/ai-assistant?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="neu-recessed bg-[#E5D8CB] relative flex items-center w-full h-12 sm:h-14 rounded-[10px] px-4.5 sm:px-5 transition-all focus-within:ring-2 focus-within:ring-[#B9833C]/40 mt-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a legal question"
          className="w-full bg-transparent text-[#34150F] placeholder-[#9A8270]/70 font-lora text-sm sm:text-base focus:outline-none pr-10 font-normal"
        />
        <button
          type="submit"
          disabled={!hasPrompt}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="absolute right-3 p-1.5 rounded-lg text-[#5C4535] hover:text-[#C58B3C] disabled:opacity-35 transition-colors focus:outline-none cursor-pointer disabled:cursor-not-allowed"
          aria-label="Send legal question"
        >
          <motion.div
            animate={
              hasPrompt && isHovered
                ? { rotate: -30, y: -2, x: 2 }
                : { rotate: 0, y: 0, x: 0 }
            }
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 22,
            }}
            whileTap={hasPrompt ? { scale: 0.9 } : undefined}
            className="flex items-center justify-center origin-center"
          >
            <SendPaperPlaneIcon className="w-5 h-5" />
          </motion.div>
        </button>
      </div>
    </form>
  );
}
