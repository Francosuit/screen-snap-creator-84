/** Auth requests and profile hydration must finish or surface a retryable error. */
export async function authTimeout<T>(work: PromiseLike<T>, milliseconds = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(work),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("La conexión tardó demasiado. Vuelve a intentarlo.")), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type SignupResult = "confirmation" | "session" | "error";

export function signupResult(data: { user: unknown; session: unknown }): SignupResult {
  if (!data.user) return "error";
  return data.session ? "session" : "confirmation";
}

export function authenticatedDestination(verified: boolean, hydrated: boolean, invite: string | null, hasHotels: boolean) {
  if (!verified || !hydrated) return null;
  return invite ?? (hasHotels ? "/mundo" : "/crear-hotel");
}