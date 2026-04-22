import { Button } from '@/components/ui/button'
import { RefreshCw, Trash2, FileText } from 'lucide-react'
import { formatDate } from '@/lib/formatters'

export interface DocumentoData {
  id: string
  title: string
  content: string
  created_at: string
  chunk_count?: number
}

interface DocumentViewerProps {
  doc: DocumentoData | null
  indexingId: string | null
  onReindex: (id: string) => void
  onDelete: (id: string) => void
}

export default function DocumentViewer({ doc, indexingId, onReindex, onDelete }: DocumentViewerProps) {
  if (!doc) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
        <FileText size={40} className="mb-3 opacity-20" />
        <p className="text-sm">Selecciona un documento para ver su contenido</p>
      </div>
    )
  }

  const isIndexing = indexingId !== null
  const isThisIndexing = indexingId === doc.id

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div>
          <p className="font-medium">{doc.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(doc.created_at)} · {doc.content.length.toLocaleString()} caracteres
            {(doc.chunk_count ?? 0) > 0 && ` · ${doc.chunk_count} chunks indexados`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onReindex(doc.id)} disabled={isIndexing}>
            <RefreshCw size={14} className={`mr-1.5 ${isThisIndexing ? 'animate-spin' : ''}`} />
            {isThisIndexing ? 'Indexando...' : 'Re-indexar'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Eliminar documento"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(doc.id)}
            disabled={isIndexing}
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
          {doc.content}
        </pre>
      </div>
    </>
  )
}
