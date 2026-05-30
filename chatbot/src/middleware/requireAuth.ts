import { Request, Response, NextFunction } from 'express'
import supabase from '../lib/supabase'

// Autentica al usuario (Bearer token) y deja su perfil en req.user, SIN exigir
// super_admin. El handler decide la autorización fina (ej. dueño del recurso).
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' })
    return
  }

  const token = authHeader.slice(7)
  const { data: userData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !userData?.user) {
    res.status(401).json({ error: 'Invalid token' })
    return
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role, client_id')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'No profile found' })
    return
  }

  req.user = { id: userData.user.id, role: profile.role, client_id: profile.client_id }
  next()
}
