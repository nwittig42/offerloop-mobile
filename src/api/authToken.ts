/**
 * Decoupling seam between the API client and the auth layer. AuthProvider
 * (built in the auth workstream) registers a token getter + an unauthorized
 * handler here, so `client.ts` can attach the Firebase ID token and react to a
 * hard 401 without importing the auth module directly (avoids a cycle).
 */
type TokenGetter = (forceRefresh?: boolean) => Promise<string | null>;

let tokenGetter: TokenGetter = async () => null;
let unauthorizedHandler: () => void = () => {};

export function registerTokenGetter(fn: TokenGetter): void {
  tokenGetter = fn;
}

export function registerUnauthorizedHandler(fn: () => void): void {
  unauthorizedHandler = fn;
}

export function getIdToken(forceRefresh?: boolean): Promise<string | null> {
  return tokenGetter(forceRefresh);
}

export function handleUnauthorized(): void {
  unauthorizedHandler();
}
