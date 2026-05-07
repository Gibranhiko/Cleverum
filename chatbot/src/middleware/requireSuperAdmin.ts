import { Request, Response, NextFunction } from 'express'
import supabase from '../lib/supabase'

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string }
    }
  }
}

export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
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
    .select('role')
    .eq('id', userData.user.id)
    .single()

  if (profileError || !profile) {
    res.status(403).json({ error: 'No profile found' })
    return
  }

  if (profile.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden — super_admin required' })
    return
  }

  req.user = { id: userData.user.id, role: profile.role }
  next()
}
