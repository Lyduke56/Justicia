'use client';

/**
 * Renders Markdown (AI responses) as React elements, styled for the parchment chat bubbles.
 * Parsing lives in lib/markdown/parse.ts; nothing here uses dangerouslySetInnerHTML, so any HTML
 * in a response is shown as plain text, and only http(s) / mailto links are clickable.
 * Long words, links, tables and code scroll or wrap inside the bubble instead of overflowing it.
 */
import React, { memo, useMemo } from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown/parse';

function renderInline(nodes: Inline[], key = ''): React.ReactNode[] {
  return nodes.map((node, i) => {
    const k = `${key}${i}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={k}>{node.value}</React.Fragment>;
      case 'break':
        return <br key={k} />;
      case 'code':
        return (
          <code key={k} className="rounded-md bg-[#34150F]/[0.07] px-1.5 py-0.5 font-mono text-[0.85em] text-[#7A3B1E] [overflow-wrap:anywhere]">
            {node.value}
          </code>
        );
      case 'strong':
        return (
          <strong key={k} className="font-bold text-[#34150F]">
            {renderInline(node.children, `${k}-`)}
          </strong>
        );
      case 'em':
        return <em key={k}>{renderInline(node.children, `${k}-`)}</em>;
      case 'del':
        return (
          <del key={k} className="text-[#7D6855]">
            {renderInline(node.children, `${k}-`)}
          </del>
        );
      case 'link':
        return (
          <a
            key={k}
            href={node.href}
            target={node.href.startsWith('mailto:') ? undefined : '_blank'}
            rel="noopener noreferrer nofollow"
            className="font-semibold text-[#946525] underline decoration-[#C58B3C]/50 underline-offset-2 transition-colors hover:text-[#C58B3C] [overflow-wrap:anywhere]"
          >
            {renderInline(node.children, `${k}-`)}
          </a>
        );
    }
  });
}

const HEADING_CLASS: Record<number, string> = {
  1: 'text-[1.3em] font-bold',
  2: 'text-[1.18em] font-bold',
  3: 'text-[1.06em] font-bold',
  4: 'text-[1em] font-semibold',
  5: 'text-[0.95em] font-semibold uppercase tracking-wide',
  6: 'text-[0.9em] font-semibold uppercase tracking-wide text-[#5C4535]',
};

const ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' } as const;

function renderBlocks(blocks: Block[], key = '', tight = false): React.ReactNode[] {
  return blocks.map((block, i) => {
    const k = `${key}${i}`;
    switch (block.type) {
      case 'heading': {
        const Tag = `h${Math.min(block.level + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
        return (
          <Tag key={k} className={`mt-5 mb-2 first:mt-0 font-lora leading-snug text-[#34150F] ${HEADING_CLASS[block.level]}`}>
            {renderInline(block.children, `${k}-`)}
          </Tag>
        );
      }
      case 'paragraph':
        return tight ? (
          <React.Fragment key={k}>{renderInline(block.children, `${k}-`)}</React.Fragment>
        ) : (
          <p key={k} className="my-2.5 first:mt-0 last:mb-0">
            {renderInline(block.children, `${k}-`)}
          </p>
        );
      case 'code':
        return (
          <div key={k} className="my-3.5 first:mt-0 last:mb-0 overflow-hidden rounded-2xl neu-recessed">
            {block.lang && (
              <div className="border-b border-[#CDBCA8]/70 px-4 py-1.5 font-inter text-[10px] font-bold uppercase tracking-[0.14em] text-[#7D6855]">
                {block.lang}
              </div>
            )}
            <pre className="neu-scrollbar-discrete overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-[#34150F]">
              <code>{block.value}</code>
            </pre>
          </div>
        );
      case 'list': {
        const ListTag = block.ordered ? 'ol' : 'ul';
        return (
          <ListTag
            key={k}
            start={block.ordered && block.start !== 1 ? block.start : undefined}
            className={`my-2.5 first:mt-0 last:mb-0 space-y-1.5 pl-5 ${
              block.ordered ? 'list-decimal marker:font-semibold' : 'list-disc'
            } marker:text-[#C58B3C]`}
          >
            {block.items.map((item, j) => {
              // A single paragraph renders inline (tight list); richer items keep their blocks.
              const isTight = item.length === 1 && item[0].type === 'paragraph';
              return (
                <li key={`${k}-${j}`} className="pl-1">
                  {renderBlocks(item, `${k}-${j}-`, isTight)}
                </li>
              );
            })}
          </ListTag>
        );
      }
      case 'quote':
        return (
          <blockquote key={k} className="my-3 first:mt-0 last:mb-0 border-l-[3px] border-[#C58B3C]/60 pl-4 italic text-[#5C4535]">
            {renderBlocks(block.children, `${k}-`)}
          </blockquote>
        );
      case 'hr':
        return <hr key={k} className="my-5 border-0 border-t border-dotted border-[#B8946E]/70" />;
      case 'table':
        return (
          <div key={k} className="my-3.5 first:mt-0 last:mb-0 overflow-x-auto neu-scrollbar-discrete rounded-2xl neu-recessed">
            <table className="w-full border-collapse font-inter text-[12.5px]">
              <thead>
                <tr>
                  {block.header.map((cell, c) => (
                    <th
                      key={c}
                      scope="col"
                      className={`border-b border-[#CDBCA8] bg-[#D39758]/20 px-3.5 py-2 font-semibold text-[#34150F] ${ALIGN[block.align[c] ?? 'left']}`}
                    >
                      {renderInline(cell, `${k}-h${c}-`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="even:bg-[#34150F]/[0.025]">
                    {row.map((cell, c) => (
                      <td key={c} className={`border-b border-[#CDBCA8]/60 px-3.5 py-2 align-top text-[#3E2A1E] ${ALIGN[block.align[c] ?? 'left']}`}>
                        {renderInline(cell, `${k}-${r}-${c}-`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  });
}

export interface MarkdownProps {
  content: string;
  /** The response is still arriving (hides half-written markers). */
  streaming?: boolean;
  className?: string;
}

export const Markdown = memo(function Markdown({ content, streaming = false, className = '' }: MarkdownProps) {
  const blocks = useMemo(() => parseMarkdown(content, { streaming }), [content, streaming]);
  return <div className={`min-w-0 [overflow-wrap:anywhere] ${className}`}>{renderBlocks(blocks)}</div>;
});

export default Markdown;
