import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ShoppingBag, CheckCircle, Circle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { formatDateTime } from '@/lib/formatters'

interface Cliente {
  id: string
  company_name: string
}

interface OrderItem {
  name: string
  qty?: number
  price?: number
}

interface Pedido {
  id: string
  client_id: string
  customer_name: string
  customer_phone: string
  items: OrderItem[]
  description: string
  date: string
  planned_date: string | null
  delivery_type: string
  total: number | null
  status: boolean
  address: string
  payment_method: string
  client_payment: number | null
  created_at: string
}

const deliveryLabel: Record<string, string> = {
  delivery: 'A domicilio',
  pickup: 'Para llevar',
  dine_in: 'En local',
}


function formatCurrency(n: number | null) {
  if (n == null) return '—'
  return `$${n.toFixed(2)}`
}

export default function Pedidos() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState<string>('')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(false)
  const [detalle, setDetalle] = useState<Pedido | null>(null)

  useEffect(() => {
    supabase
      .from('clients')
      .select('id, company_name')
      .eq('is_active', true)
      .order('company_name')
      .then(({ data }) => {
        const list = data ?? []
        setClientes(list)
        if (list[0]) setClienteId(list[0].id)
      })
  }, [])

  useEffect(() => {
    if (!clienteId) return
    fetchPedidos()

    const channel = supabase
      .channel(`pedidos-${clienteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchPedidos())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `client_id=eq.${clienteId}`,
      }, () => fetchPedidos())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clienteId])

  async function fetchPedidos() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('client_id', clienteId)
      .order('created_at', { ascending: false })
    setPedidos((data ?? []) as Pedido[])
    setLoading(false)
  }

  async function toggleStatus(id: string, current: boolean) {
    const { error } = await supabase.from('orders').update({ status: !current }).eq('id', id)
    if (error) { toast.error('Error al actualizar el pedido'); return }
    toast.success(current ? 'Pedido reabierto' : 'Pedido completado')
    fetchPedidos()
  }

  const pendientes = pedidos.filter(p => !p.status).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pedidos</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pendientes > 0
              ? `${pendientes} pedido${pendientes !== 1 ? 's' : ''} pendiente${pendientes !== 1 ? 's' : ''}`
              : `${pedidos.length} pedido${pedidos.length !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" aria-label="Refrescar pedidos" onClick={fetchPedidos} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">Estado</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Fecha pedido</TableHead>
              <TableHead>Entrega</TableHead>
              <TableHead className="w-20">Ver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!clienteId ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  Selecciona un cliente.
                </TableCell>
              </TableRow>
            ) : loading ? (
              <>
                {[...Array(4)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-4 w-4 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-28 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-20 bg-muted rounded-full animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-14 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-32 bg-muted rounded animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-10 bg-muted rounded animate-pulse" /></TableCell>
                  </TableRow>
                ))}
              </>
            ) : pedidos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                  No hay pedidos aún.
                </TableCell>
              </TableRow>
            ) : pedidos.map(p => (
              <TableRow key={p.id} className={!p.status ? 'bg-amber-50/50' : ''}>
                <TableCell>
                  {p.status
                    ? <CheckCircle size={18} className="text-emerald-500" />
                    : <Circle size={18} className="text-amber-500" />}
                </TableCell>
                <TableCell>
                  <p className="font-medium text-sm">{p.customer_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">{p.customer_phone || ''}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {deliveryLabel[p.delivery_type] ?? p.delivery_type ?? '—'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">{formatCurrency(p.total)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(p.created_at)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateTime(p.planned_date)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setDetalle(p)}>
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detalle del pedido */}
      <Dialog open={!!detalle} onOpenChange={() => setDetalle(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalle del pedido</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{detalle.customer_name || '—'}</span>
                <span className="text-muted-foreground">Teléfono</span>
                <span>{detalle.customer_phone || '—'}</span>
                <span className="text-muted-foreground">Tipo entrega</span>
                <span>{deliveryLabel[detalle.delivery_type] ?? detalle.delivery_type ?? '—'}</span>
                {detalle.address && (
                  <>
                    <span className="text-muted-foreground">Dirección</span>
                    <span>{detalle.address}</span>
                  </>
                )}
                <span className="text-muted-foreground">Pago</span>
                <span>{detalle.payment_method || '—'}</span>
                {detalle.client_payment != null && (
                  <>
                    <span className="text-muted-foreground">Paga con</span>
                    <span>{formatCurrency(detalle.client_payment)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Total</span>
                <span className="font-semibold">{formatCurrency(detalle.total)}</span>
                <span className="text-muted-foreground">Fecha pedido</span>
                <span>{formatDateTime(detalle.created_at)}</span>
                {detalle.planned_date && (
                  <>
                    <span className="text-muted-foreground">Entrega planeada</span>
                    <span>{formatDateTime(detalle.planned_date)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Estado</span>
                <span>
                  {detalle.status
                    ? <Badge variant="default" className="bg-emerald-500">Completado</Badge>
                    : <Badge variant="outline" className="text-amber-600 border-amber-400">Pendiente</Badge>}
                </span>
              </div>

              {detalle.description && (
                <div>
                  <p className="text-muted-foreground mb-1">Descripción</p>
                  <p className="bg-muted rounded-md px-3 py-2">{detalle.description}</p>
                </div>
              )}

              {Array.isArray(detalle.items) && detalle.items.length > 0 && (
                <div>
                  <p className="text-muted-foreground mb-2">Artículos</p>
                  <div className="rounded-md border divide-y">
                    {detalle.items.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-3 py-2">
                        <span>{item.qty ? `${item.qty}x ` : ''}{item.name}</span>
                        {item.price != null && (
                          <span className="text-muted-foreground">{formatCurrency(item.price)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                variant={detalle.status ? 'outline' : 'default'}
                onClick={() => {
                  toggleStatus(detalle.id, detalle.status)
                  setDetalle(null)
                }}
              >
                {detalle.status ? 'Reabrir pedido' : 'Marcar como completado'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
