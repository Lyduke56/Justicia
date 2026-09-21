/**
 * Legal Knowledge Base Retrieval Stub
 *
 * Implements the retrieval step of the RAG (Retrieval-Augmented Generation) pipeline.
 * In production this will query a vector store (e.g. pgvector via Supabase) seeded
 * with Philippine statutes, jurisprudence, and administrative issuances.
 *
 * TODO: Implement pgvector similarity search against the `legal_sources` table
 */

export interface RetrievedChunk {
  sourceId: string;
  title: string;
  citation: string;
  excerpt: string;
  similarity: number;
}

/**
 * Retrieves the most relevant legal source chunks for a given query.
 * Currently returns stub data.
 */
export async function retrieveLegalChunks(
  query: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  // TODO: Replace stub with pgvector similarity search
  // const embedding = await embedText(query);
  // const { data } = await supabase.rpc('match_legal_sources', { query_embedding: embedding, match_count: topK });
  // return data.map(...);

  console.log('[Retrieval Stub] retrieveLegalChunks for query:', query, 'topK:', topK);
  return [
    {
      sourceId: 'stub-001',
      title: 'Republic Act No. 386 — Civil Code of the Philippines',
      citation: 'RA 386',
      excerpt: '[STUB] Placeholder excerpt from the Civil Code.',
      similarity: 0.95,
    },
    {
      sourceId: 'stub-002',
      title: 'Republic Act No. 8484 — Access Devices Regulation Act',
      citation: 'RA 8484',
      excerpt: '[STUB] Placeholder excerpt from RA 8484.',
      similarity: 0.82,
    },
  ];
}

/**
 * Classifies the legal issue category of a user query.
 * TODO: Implement with LLM zero-shot or fine-tuned classifier
 */
export async function classifyLegalIssue(query: string): Promise<string> {
  console.log('[Retrieval Stub] classifyLegalIssue for query:', query);
  // TODO: Implement classification
  return 'civil-law';
}
