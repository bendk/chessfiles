import pkceChallenge from "pkce-challenge";

const CLIENT_ID = "chessfiles-27717";

export async function startLogin() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const state = buf[0].toString();
  const { code_verifier, code_challenge } = await pkceChallenge();

  localStorage.setItem(
    "lichess-oauth-login",
    JSON.stringify({ state, code_verifier }),
  );

  const url = new URL("https://lichess.org/oauth/");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", CLIENT_ID);
  url.searchParams.append("redirect_uri", `${window.location.origin}/`);
  url.searchParams.append("code_challenge_method", "S256");
  url.searchParams.append("code_challenge", code_challenge);
  url.searchParams.append("state", `lichess-auth-state:${state}`);
  window.open(url, "_self");
}

export async function completeLogin(state: string, code: string | null) {
  const storedJson = localStorage.getItem("lichess-oauth-login");
  localStorage.removeItem("lichess-oauth-login");
  const stored = storedJson ? JSON.parse(storedJson) : null;

  if (stored === null || stored.state != state || code === null) {
    window.open(window.location.origin, "_self");
    return;
  }

  const url = new URL("https://lichess.org/api/token");
  const resp = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      code,
      code_verifier: stored.code_verifier,
      grant_type: "authorization_code",
      redirect_uri: `${window.location.origin}/`,
    }),
  });
  const data = await resp.json();
  localStorage.setItem("lichess-oauth", JSON.stringify(data));
  window.open(`${window.location.origin}`, "_self");
}

interface OAuthData {
  access_token: string;
  refresh_token: string;
}

function getOauthData(): OAuthData | undefined {
  const serialized = localStorage.getItem("lichess-oauth");
  if (serialized === null) {
    return undefined;
  }
  return JSON.parse(serialized) as OAuthData;
}

export function isAuthorized(): boolean {
  return getOauthData()?.access_token !== undefined;
}

export function getAccessToken(): string | undefined {
  return getOauthData()?.access_token;
}

export function authHeaders(): Headers | null {
  const accessToken = getAccessToken();
  if (accessToken === undefined) {
    return null;
  }
  const headers = new Headers();
  headers.append("Authorization", `Bearer ${accessToken}`);
  return headers;
}

export async function disconnect() {
  const headers = authHeaders();
  if (headers === null) {
    return;
  }
  const url = new URL("https://lichess.org/api/token");
  await fetch(url, { method: "DELETE", headers });
  localStorage.removeItem("dropbox-oauth");
}
