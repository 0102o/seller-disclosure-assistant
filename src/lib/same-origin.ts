/**
 * Rejects browser requests coming from another website, so a third-party page
 * can't spend the API key through a visitor's browser. This is not
 * authentication: a public deployment would also need sign-in and rate limits.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Non-browser clients (curl) don't send Origin.
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
