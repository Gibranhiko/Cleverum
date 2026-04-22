import { Request, Response, NextFunction } from 'express'

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key']
  if (!process.env.ADMIN_API_KEY || key !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}
