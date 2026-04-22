import { OpenAI } from 'openai'
import supabase from '../lib/supabase'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 })

export function splitIntoChunks(text: string, size = 400, overlap = 50): string[] {
  const words = text.split(/\s+/)
  const tokenEstimate = (w: string[]) => Math.ceil(w.length * 1.3)
  const chunks: string[] = []
  let start = 0

  while (start < words.length) {
    let end = start
    while (end < words.length && tokenEstimate(words.slice(start, end + 1)) < size) {
      end++
    }
    if (end === start) end = start + 1
    chunks.push(words.slice(start, end).join(' '))
    const step = Math.max(1, end - start - overlap)
    start += step
  }

  return chunks.filter(c => c.trim().length > 0)
}

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return response.data[0].embedding
}

export async function indexDocument(documentId: string, content: string, clientId: string): Promise<number> {
  await supabase
    .from('document_chunks')
    .delete()
    .eq('document_id', documentId)

  const chunks = splitIntoChunks(content)

  const rows: { document_id: string; client_id: string; content: string; embedding: number[] }[] = []
  for (const chunk of chunks) {
    const embedding = await embed(chunk)
    rows.push({ document_id: documentId, client_id: clientId, content: chunk, embedding })
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('document_chunks').insert(rows)
    if (error) throw error
  }

  return rows.length
}

export async function getRagContext(query: string, clientId: string, prefix = 'Información real de la empresa:'): Promise<string> {
  const chunks = await retrieve(query, clientId).catch(() => [] as string[])
  return chunks.length > 0 ? `${prefix}\n\n${chunks.join('\n\n')}` : ''
}

export async function retrieve(query: string, clientId: string, threshold = 0.75, count = 4): Promise<string[]> {
  const queryEmbedding = await embed(query)

  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: queryEmbedding,
    client_id_filter: clientId,
    match_threshold: threshold,
    match_count: count,
  })

  if (error) {
    console.error('RAG retrieve error:', error.message)
    return []
  }

  return (data ?? []).map((row: { content: string }) => row.content)
}
