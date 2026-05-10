import { useRef } from 'react'
import { Image as ImageIcon, FileIcon, Upload, Loader2 } from 'lucide-react'
import { Label } from './label'

interface FileUploadFieldProps {
  label: string
  hint?: string
  accept?: string
  variant?: 'image' | 'file'

  // For image variant
  imageUrl?: string | null

  // For file variant
  fileName?: string | null
  fileExists?: boolean    // when there's already a file uploaded but you don't have a name (e.g., "✓ archivo configurado")

  uploading?: boolean
  disabled?: boolean
  disabledHint?: string
  error?: string

  onFileSelected: (file: File) => void
  onClear?: () => void
}

export function FileUploadField({
  label,
  hint,
  accept = 'image/*',
  variant = 'image',
  imageUrl,
  fileName,
  fileExists,
  uploading = false,
  disabled = false,
  disabledHint,
  error,
  onFileSelected,
  onClear,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = variant === 'image' ? !!imageUrl : (!!fileName || !!fileExists)

  function handleClick() {
    if (disabled || uploading) return
    inputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    // Reset input para que se pueda seleccionar el mismo archivo otra vez
    e.target.value = ''
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />

      {/* Image variant — preview lado a lado */}
      {variant === 'image' && hasValue && (
        <div className="flex items-center gap-3">
          <img
            src={imageUrl!}
            alt="Preview"
            className="h-20 w-20 rounded-md object-cover border bg-muted/50"
          />
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled || uploading}
              className="text-xs text-foreground hover:underline disabled:opacity-50 self-start"
            >
              {uploading ? 'Subiendo...' : 'Cambiar imagen'}
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                disabled={uploading}
                className="text-xs text-destructive hover:underline self-start disabled:opacity-50"
              >
                Quitar
              </button>
            )}
          </div>
        </div>
      )}

      {/* File variant — chip con nombre */}
      {variant === 'file' && hasValue && (
        <div
          className="flex items-center gap-3 rounded-md border border-input px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors"
          onClick={handleClick}
        >
          <FileIcon size={16} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate text-muted-foreground">
            {uploading
              ? 'Subiendo...'
              : fileName
                ? `${fileName}`
                : '✓ Archivo configurado — clic para reemplazar'}
          </span>
        </div>
      )}

      {/* Empty state — placeholder clickable */}
      {!hasValue && (
        <div
          className={`flex items-center gap-3 rounded-md border border-input border-dashed px-3 py-3 text-sm transition-colors ${
            disabled
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:bg-accent hover:border-foreground/30'
          }`}
          onClick={handleClick}
        >
          {uploading ? (
            <Loader2 size={16} className="shrink-0 text-muted-foreground animate-spin" />
          ) : variant === 'image' ? (
            <ImageIcon size={16} className="shrink-0 text-muted-foreground" />
          ) : (
            <Upload size={16} className="shrink-0 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">
            {uploading
              ? 'Subiendo...'
              : variant === 'image'
                ? 'Seleccionar imagen'
                : 'Seleccionar archivo'}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      {disabled && disabledHint && <p className="text-xs text-amber-600">{disabledHint}</p>}
      {!error && !disabled && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
