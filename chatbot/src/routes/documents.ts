import { Router, Request, Response } from 'express'
import supabase from '../lib/supabase'
import { indexDocument } from '../services/rag'

const router = Router()

router.post('/:clientId/index', async (req: Request, res: Response) => {
  const { clientId } = req.params
  const { documentId } = req.query as { documentId?: string }

  if (!documentId) {
    res.status(400).json({ error: 'documentId query param is required' })
    return
  }

  const { data: doc, error } = await supabase
    .from('documents')
    .select('id, content, client_id')
    .eq('id', documentId)
    .eq('client_id', clientId)
    .single()

  if (error || !doc) {
    res.status(404).json({ error: 'Document not found' })
    return
  }

  try {
    const chunksCreated = await indexDocument(doc.id, doc.content, clientId)
    res.json({ chunks_created: chunksCreated })
  } catch (err: any) {
    console.error('Indexing error:', err?.message ?? err)
    res.status(500).json({ error: 'Indexing failed', details: err?.message })
  }
})

export default router
