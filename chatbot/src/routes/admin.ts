import { Router, Request, Response } from 'express'
import supabase from '../lib/supabase'

const router = Router()

const VALID_ROLES = ['super_admin', 'user']

// Páginas que un `user` NUNCA puede tener (solo super_admin). Espejo de
// SUPER_ADMIN_ONLY_PAGES en frontend/src/lib/permissions.ts.
// Usamos lista NEGRA (no blanca) a propósito: así cualquier página nueva que
// se agregue al panel se puede asignar sin tocar este archivo. Solo hay que
// actualizar esto si se crea una NUEVA página super-admin-only.
const SUPER_ADMIN_ONLY_PAGES = new Set([
  'clientes',
  'usuarios',
])

function sanitizeAllowedPages(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter(
    (p): p is string => typeof p === 'string' && p.length > 0 && !SUPER_ADMIN_ONLY_PAGES.has(p)
  )
}

async function countSuperAdmins(): Promise<number> {
  const { count, error } = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'super_admin')
  if (error) throw error
  return count ?? 0
}

router.get('/users', async (_req: Request, res: Response) => {
  try {
    const { data: profiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, role, client_id, allowed_pages, full_name, created_at')
      .order('created_at', { ascending: false })

    if (profilesError) {
      res.status(500).json({ error: profilesError.message })
      return
    }

    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) {
      res.status(500).json({ error: authError.message })
      return
    }

    const emailMap = new Map<string, string | undefined>(
      authData.users.map(u => [u.id, u.email] as [string, string | undefined])
    )
    const enriched = (profiles ?? []).map(p => ({ ...p, email: emailMap.get(p.id) ?? null }))

    res.json({ users: enriched })
  } catch (err: any) {
    console.error('[Admin] GET /users error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/users', async (req: Request, res: Response) => {
  try {
    const { email, password, full_name, role, client_id, allowed_pages } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' })
      return
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' })
      return
    }
    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({ error: 'Invalid role' })
      return
    }
    if (role === 'user' && !client_id) {
      res.status(400).json({ error: 'client_id is required when role=user' })
      return
    }

    const { data: created, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !created?.user) {
      res.status(500).json({ error: authError?.message ?? 'Failed to create auth user' })
      return
    }

    const profilePayload = {
      id: created.user.id,
      role,
      client_id: role === 'super_admin' ? null : client_id,
      allowed_pages: role === 'super_admin' ? [] : sanitizeAllowedPages(allowed_pages),
      full_name: full_name ?? null,
    }

    const { error: profileError } = await supabase.from('user_profiles').insert(profilePayload)
    if (profileError) {
      // Rollback the auth user
      await supabase.auth.admin.deleteUser(created.user.id)
      res.status(500).json({ error: profileError.message })
      return
    }

    console.log(`[Admin] user created: ${email} role=${role} client_id=${client_id ?? '-'}`)
    res.json({ id: created.user.id })
  } catch (err: any) {
    console.error('[Admin] POST /users error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { full_name, role, client_id, allowed_pages } = req.body

    const updates: Record<string, unknown> = {}

    if (full_name !== undefined) updates.full_name = full_name

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        res.status(400).json({ error: 'Invalid role' })
        return
      }

      // Brick prevention: si se está demoting un super_admin a user,
      // verificar que no es el último super_admin del sistema.
      if (role === 'user') {
        const { data: target } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', id)
          .single()

        if (target?.role === 'super_admin') {
          const total = await countSuperAdmins()
          if (total <= 1) {
            res.status(400).json({
              error: 'No se puede demotar al último super_admin. Crea otro super_admin antes de cambiar el rol de éste.',
            })
            return
          }
        }
      }

      updates.role = role
      if (role === 'super_admin') {
        updates.client_id = null
        updates.allowed_pages = []
      } else {
        if (!client_id) {
          res.status(400).json({ error: 'client_id required when role=user' })
          return
        }
        updates.client_id = client_id
        updates.allowed_pages = sanitizeAllowedPages(allowed_pages)
      }
    } else {
      if (client_id !== undefined) updates.client_id = client_id
      if (allowed_pages !== undefined) updates.allowed_pages = sanitizeAllowedPages(allowed_pages)
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'No fields to update' })
      return
    }

    const { error } = await supabase.from('user_profiles').update(updates).eq('id', id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[Admin] PATCH /users/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (req.user?.id === id) {
      res.status(400).json({ error: 'Cannot delete your own user' })
      return
    }

    // Brick prevention: no permitir eliminar al último super_admin
    const { data: target } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', id)
      .single()

    if (target?.role === 'super_admin') {
      const total = await countSuperAdmins()
      if (total <= 1) {
        res.status(400).json({
          error: 'No se puede eliminar al último super_admin. Crea otro antes de eliminar éste.',
        })
        return
      }
    }

    const { error } = await supabase.auth.admin.deleteUser(id)
    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[Admin] DELETE /users/:id error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
