import { Request, Response, NextFunction } from 'express';
import * as db from '../db';

const COOKIE = 'unplayed_session';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      sessionId: string;
      userId: string | null;
    }
  }
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE] as string | undefined;
  let session = token ? db.getSession(token) : null;

  // Expired or missing — create fresh session
  if (!session || new Date(session.expiresAt) < new Date()) {
    session = db.createSession();
    setCookie(res, session.id);
  }

  req.sessionId = session.id;
  req.userId = session.userId;
  next();
}

function setCookie(res: Response, value: string): void {
  res.cookie(COOKIE, value, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}
