import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, FileText, ChevronRight, RefreshCw } from 'lucide-react'
import { CHATBOT_URL, chatbotHeaders } from '@/lib/config'
import { formatDate } from '@/lib/formatters'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

interface Documento {
  id: string
  client_id: string
  title: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  chunk_count?: number
}


export default function Documentos() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [docs, setDocs] = useState<Documento[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Documento | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Indexing state
  const [indexingId, setIndexingId] = useState<string | null>(null)
  const [indexError, setIndexError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name, bot_type')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = (data ?? []) as Cliente[]
        const filtered = list.filter(c => c.bot_type === 'informativo' || c.bot_type === 'leads')
        setClientes(filtered)
        if (filtered[0]) setClienteId(filtered[0].id)
      })
  }, [])

  useEffect(() => { if (clienteId) fetchDocs() }, [clienteId])

  async function fetchDocs() {
    setLoading(true)
    const { data: docData } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })

    if (!docData) { setDocs([]); setLoading(false); return }

    const { data: chunkData } = await supabase
      .from('document_chunks')
      .select('document_id')
      .in('document_id', docData.map(d => d.id))

    const countMap: Record<string, number> = {}
    for (const c of chunkData ?? []) {
      countMap[c.document_id] = (countMap[c.document_id] ?? 0) + 1
    }

    const withCounts = docData.map(d => ({ ...d, chunk_count: countMap[d.id] ?? 0 })) as Documento[]
    setDocs(withCounts)
    setSelected(prev => prev ? (withCounts.find(d => d.id === prev.id) ?? null) : null)
    setLoading(false)
  }

  async function runIndexing(documentId: string) {
    setIndexingId(documentId)
    setIndexError(null)
    try {
      const res = await fetch(`${CHATBOT_URL}/documents/${clienteId}/index?documentId=${documentId}`, {
        method: 'POST',
        headers: chatbotHeaders,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
    } catch (err: any) {
      setIndexError(`Error al indexar: ${err?.message ?? 'Error desconocido'}`)
    } finally {
      setIndexingId(null)
      fetchDocs()
    }
  }

  function openNew() {
    setFormTitle('')
    setFormContent('')
    setFormError('')
    setModalOpen(true)
  }

  async function handleSave() {
    if (!formTitle.trim()) { setFormError('El título es requerido'); return }
    if (!formContent.trim()) { setFormError('El contenido es requerido'); return }
    setSaving(true)
    setFormError('')

    const { data, error } = await supabase
      .from('documents')
      .insert({ client_id: clienteId, title: formTitle.trim(), content: formContent.trim() })
      .select('id')
      .single()

    setSaving(false)
    if (error) { setFormError(error.message); return }
    setModalOpen(false)
    await fetchDocs()
    if (data?.id) runIndexing(data.id)
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    await supabase.from('document_chunks').delete().eq('document_id', deleteId)
    await supabase.from('documents').delete().eq('id', deleteId)
    if (selected?.id === deleteId) setSelected(null)
    setDeleteId(null)
    setDeleting(false)
    fetchDocs()
  }

  const isIndexing = indexingId !== null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Documentos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Base de conocimiento para RAG · {docs.length} documento{docs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={v => { setClienteId(v); setSelected(null); setIndexError(null) }}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.company_name}
                  <span className="ml-2 text-xs text-muted-foreground">({c.bot_type})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openNew} disabled={!clienteId || isIndexing}>
            <Plus size={16} className="mr-1.5" />Nuevo documento
          </Button>
        </div>
      </div>

      {clientes.length === 0 && !loading && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Los documentos RAG solo aplican para bots tipo <strong>Informativo</strong> y <strong>Leads</strong>.
          No hay clientes con esos tipos aún.
        </div>
      )}

      {indexError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {indexError}
        </div>
      )}

      <div className="flex gap-4 min-h-[400px]">
        {/* Lista de documentos */}
        <div className="w-72 shrink-0 rounded-lg border bg-card overflow-y-auto">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground text-center">Cargando...</div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm p-4 text-center">
              <FileText size={28} className="mb-2 opacity-30" />
              Sin documentos. Crea el primero.
            </div>
          ) : docs.map(d => (
            <button
              key={d.id}
              onClick={() => setSelected(d)}
              className={`w-full text-left px-3 py-2.5 border-b last:border-b-0 hover:bg-muted/50 transition-colors ${selected?.id === d.id ? 'bg-muted' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatDate(d.created_at)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {indexingId === d.id
                    ? <Badge variant="secondary" className="text-xs animate-pulse">Indexando...</Badge>
                    : (d.chunk_count ?? 0) > 0
                      ? <Badge variant="secondary" className="text-xs">{d.chunk_count} chunks</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Sin indexar</Badge>}
                  <ChevronRight size={14} className="text-muted-foreground" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Vista previa del documento */}
        <div className="flex-1 rounded-lg border bg-card flex flex-col min-w-0">
          {!selected ? (
            <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
              <FileText size={40} className="mb-3 opacity-20" />
              <p className="text-sm">Selecciona un documento para ver su contenido</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                <div>
                  <p className="font-medium">{selected.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(selected.created_at)} · {selected.content.length.toLocaleString()} caracteres
                    {(selected.chunk_count ?? 0) > 0 && ` · ${selected.chunk_count} chunks indexados`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runIndexing(selected.id)}
                    disabled={isIndexing}
                  >
                    <RefreshCw size={14} className={`mr-1.5 ${indexingId === selected.id ? 'animate-spin' : ''}`} />
                    {indexingId === selected.id ? 'Indexando...' : 'Re-indexar'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(selected.id)}
                    disabled={isIndexing}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {selected.content}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal nuevo documento */}
      <Dialog open={modalOpen} onOpenChange={() => setModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nuevo documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Título *</Label>
              <Input
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Ej. FAQ del negocio, Descripción de servicios, Precios..."
              />
            </div>
            <Separator />
            <div className="space-y-1.5 flex flex-col flex-1">
              <Label>Contenido *</Label>
              <p className="text-xs text-muted-foreground">
                Pega aquí el texto del documento. Puede ser FAQs, descripción de servicios, políticas, precios, etc.
                El bot usará este contenido para responder preguntas.
              </p>
              <textarea
                value={formContent}
                onChange={e => setFormContent(e.target.value)}
                placeholder="Escribe o pega el contenido del documento aquí..."
                rows={14}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">{formContent.length.toLocaleString()} caracteres</p>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminación */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>¿Eliminar documento?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Se eliminará el documento y todos sus chunks indexados. No se puede deshacer.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
