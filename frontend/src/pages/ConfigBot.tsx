import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Save, Plus, Trash2 } from 'lucide-react'

interface Cliente {
  id: string
  company_name: string
  bot_type: string
}

interface BotConfig {
  client_id: string
  welcome_message: string
  system_prompt: string
  closing_message: string
  intents_enabled: string[]
  qualification_questions: string[]
}

const INFO_INTENTS = ['agendar_cita', 'consultar_empresa', 'hablar']
const DEFAULT_CONFIG: Omit<BotConfig, 'client_id'> = {
  welcome_message: '',
  system_prompt: '',
  closing_message: '',
  intents_enabled: INFO_INTENTS,
  qualification_questions: [],
}

export default function ConfigBot() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [config, setConfig] = useState<Omit<BotConfig, 'client_id'>>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newQuestion, setNewQuestion] = useState('')

  const selectedCliente = clientes.find(c => c.id === clienteId)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name, bot_type')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = (data ?? []) as Cliente[]
        setClientes(list)
        if (list[0]) setClienteId(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchConfig()
  }, [clienteId])

  async function fetchConfig() {
    setLoading(true)
    setSaved(false)
    const { data } = await supabase
      .from('bot_configs')
      .select('*')
      .eq('client_id', clienteId)
      .single()
    setConfig(data ? {
      welcome_message: data.welcome_message ?? '',
      system_prompt: data.system_prompt ?? '',
      closing_message: data.closing_message ?? '',
      intents_enabled: data.intents_enabled ?? INFO_INTENTS,
      qualification_questions: data.qualification_questions ?? [],
    } : DEFAULT_CONFIG)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('bot_configs')
      .upsert({ client_id: clienteId, ...config }, { onConflict: 'client_id' })
    setSaving(false)
    if (!error) setSaved(true)
  }

  function toggleIntent(intent: string) {
    setConfig(prev => ({
      ...prev,
      intents_enabled: prev.intents_enabled.includes(intent)
        ? prev.intents_enabled.filter(i => i !== intent)
        : [...prev.intents_enabled, intent],
    }))
    setSaved(false)
  }

  function addQuestion() {
    if (!newQuestion.trim()) return
    setConfig(prev => ({
      ...prev,
      qualification_questions: [...prev.qualification_questions, newQuestion.trim()],
    }))
    setNewQuestion('')
    setSaved(false)
  }

  function removeQuestion(idx: number) {
    setConfig(prev => ({
      ...prev,
      qualification_questions: prev.qualification_questions.filter((_, i) => i !== idx),
    }))
    setSaved(false)
  }

  function moveQuestion(idx: number, dir: -1 | 1) {
    const next = [...config.qualification_questions]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setConfig(prev => ({ ...prev, qualification_questions: next }))
    setSaved(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Configuración del bot</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Personaliza el comportamiento de cada bot</p>
        </div>
        <Select value={clienteId} onValueChange={v => { setClienteId(v) }}>
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
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando...</div>
      ) : clienteId ? (
        <div className="space-y-6">
          <div className="space-y-1.5">
            <Label>Mensaje de bienvenida</Label>
            <p className="text-xs text-muted-foreground">Lo primero que ve el usuario al iniciar la conversación.</p>
            <textarea
              value={config.welcome_message}
              onChange={e => { setConfig(p => ({ ...p, welcome_message: e.target.value })); setSaved(false) }}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Hola 👋 Bienvenido a {{nombre de empresa}}..."
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Prompt del sistema</Label>
              <span className="text-xs text-muted-foreground">{config.system_prompt.length} chars</span>
            </div>
            <p className="text-xs text-muted-foreground">Instrucciones base para la IA. Deja vacío para usar el prompt por defecto.</p>
            <textarea
              value={config.system_prompt}
              onChange={e => { setConfig(p => ({ ...p, system_prompt: e.target.value })); setSaved(false) }}
              rows={8}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
              placeholder="Eres un agente de ventas para..."
            />
          </div>

          <div className="space-y-1.5">
            <Label>Mensaje de cierre</Label>
            <Input
              value={config.closing_message}
              onChange={e => { setConfig(p => ({ ...p, closing_message: e.target.value })); setSaved(false) }}
              placeholder="¡Gracias por contactarnos! Estamos para servirte."
            />
          </div>

          {selectedCliente?.bot_type === 'informativo' && (
            <div className="space-y-2">
              <Label>Intents habilitados</Label>
              <div className="space-y-2">
                {INFO_INTENTS.map(intent => (
                  <label key={intent} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.intents_enabled.includes(intent)}
                      onChange={() => toggleIntent(intent)}
                      className="rounded border-input"
                    />
                    <span className="text-sm font-mono">{intent}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {selectedCliente?.bot_type === 'leads' && (
            <div className="space-y-2">
              <Label>Preguntas de calificación</Label>
              <p className="text-xs text-muted-foreground">El bot las hará en este orden para calificar al prospecto.</p>
              <div className="space-y-2">
                {config.qualification_questions.map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
                    <span className="flex-1 text-sm border rounded-md px-3 py-1.5 bg-muted/30">{q}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(i, -1)} disabled={i === 0}>↑</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveQuestion(i, 1)} disabled={i === config.qualification_questions.length - 1}>↓</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeQuestion(i)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newQuestion}
                  onChange={e => setNewQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addQuestion() }}
                  placeholder="Nueva pregunta..."
                />
                <Button variant="outline" onClick={addQuestion} disabled={!newQuestion.trim()}>
                  <Plus size={14} className="mr-1" />Agregar
                </Button>
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            <Save size={15} className="mr-1.5" />
            {saving ? 'Guardando...' : saved ? 'Guardado ✓' : 'Guardar configuración'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Selecciona un cliente para editar su configuración.</p>
      )}
    </div>
  )
}
