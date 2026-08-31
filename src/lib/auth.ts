import crypto from 'crypto';
import { AppUser, UserRole } from './types';
import { NextRequest } from 'next/server';

const PASSWORD_ROUNDS = 900;
const SESSION_SECRET = process.env.SESSION_SECRET_KEY || 'jQdeiIe45CFVsB5tDzeM1oSH5ZC9WSv8yFer7FLG5xTybEhUUavge8ZiyR4RCxs';

export function normalizeHash(str: string): string {
  return String(str || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').trim();
}

export function hashPassword(password: string, salt: string): string {
  let value = `${password}|${salt}`;
  for (let i = 0; i < PASSWORD_ROUNDS; i++) {
    value = crypto.createHash('sha256').update(`${value}|${salt}`).digest('base64');
  }
  return value;
}

export function newSalt(): string {
  return crypto.randomBytes(18).toString('base64');
}

export function safeEquals(a: string, b: string): boolean {
  const normA = normalizeHash(a);
  const normB = normalizeHash(b);
  if (normA.length !== normB.length) return false;
  return crypto.timingSafeEqual(Buffer.from(normA), Buffer.from(normB));
}

export interface SessionPayload {
  u: string;
  name: string;
  role: UserRole;
  e: number;
  n: string;
}

export function signToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `v1.${body}.${signature}`;
}

export function verifyToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return null;

  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(parts[1]).digest('base64url');
  if (!safeEquals(parts[2], expectedSig)) return null;

  try {
    const jsonStr = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(jsonStr) as SessionPayload;
    if (!payload || !payload.u || !payload.e || payload.e <= Date.now()) {
      return null;
    }
    return payload;
  } catch (err) {
    return null;
  }
}

export function sha256Text(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function getTokenFromRequest(req: NextRequest): string {
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookieToken = req.cookies.get('cph_tm_token')?.value;
  if (cookieToken) return cookieToken;

  const queryToken = req.nextUrl.searchParams.get('token');
  if (queryToken) return queryToken;

  return '';
}
