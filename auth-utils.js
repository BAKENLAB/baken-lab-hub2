// Shared server-side authentication helpers. Never import this file from browser pages.
export const COOKIE_NAME = 'baken_hub_session';
// Maximum idle session is one year; password rotation invalidates every issued token.
export const SESSION_TTL_SECONDS = 365 * 24 * 60 * 60;
export const SESSION_REFRESH_WINDOW_SECONDS = 30 * 24 * 60 * 60;
const encoder = new TextEncoder();

function toHex(bytes) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sign(message, secret) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}
export function safeEquals(a, b) {
  const x = encoder.encode(String(a)), y = encoder.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
export async function passwordMatches(candidate, expected) {
  if (typeof candidate !== 'string' || !expected || candidate.length > 256) return false;
  const [actual, target] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(candidate)), crypto.subtle.digest('SHA-256', encoder.encode(expected))]);
  return safeEquals(toHex(actual), toHex(target));
}
export async function createSession(secret) {
  if (!secret || secret.length < 32) throw new Error('Session secret is missing');
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const message = `v1.${expires}.${nonce}`;
  return `${message}.${await sign(message, secret)}`;
}
export async function authenticatedSessionExpiresAt(cookieHeader, secret) {
  if (!cookieHeader || !secret || secret.length < 32) return null;
  const cookie = cookieHeader.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE_NAME + '='));
  if (!cookie) return null;
  const value = cookie.slice(COOKIE_NAME.length + 1);
  const match = /^v1\.(\d{10,12})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(value);
  if (!match) return null;
  const expires = Number(match[1]), now = Math.floor(Date.now() / 1000);
  if (expires <= now || expires > now + SESSION_TTL_SECONDS + 60) return null;
  const message = `v1.${match[1]}.${match[2]}`;
  return safeEquals(match[3], await sign(message, secret)) ? expires : null;
}
export async function isAuthenticated(cookieHeader, secret) {
  return (await authenticatedSessionExpiresAt(cookieHeader, secret)) !== null;
}
export function safeDestination(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\r\n]/.test(value) || value.length > 500) return '/';
  if (value.startsWith('/api/') || value.startsWith('/login.html')) return '/';
  return value;
}
