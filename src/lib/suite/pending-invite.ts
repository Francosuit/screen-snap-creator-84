// Pending invitation kept only in this tab (sessionStorage) while the user signs in or registers.
const KEY = "suite-next";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only a same-origin invite path with a well-formed token is accepted. */
export function invitePath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = /^\/invitacion\?token=([0-9a-f-]{36})$/i.exec(raw);
  return m && UUID.test(m[1]) ? `/invitacion?token=${m[1].toLowerCase()}` : null;
}

export function rememberInvite(token: string) {
  const p = invitePath(`/invitacion?token=${token}`);
  if (p) sessionStorage.setItem(KEY, p);
}

export function peekInvite(): string | null {
  return typeof window === "undefined" ? null : invitePath(sessionStorage.getItem(KEY));
}

export function takeInvite(): string | null {
  const p = peekInvite();
  sessionStorage.removeItem(KEY);
  return p;
}
