import pkceChallenge from "pkce-challenge";

interface OAuthData {
  access_token: string;
  refresh_token: string;
}

export async function startLogin() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const state = buf[0].toString();
  const { code_verifier, code_challenge } = await pkceChallenge();

  localStorage.setItem(
    "dropbox-oauth-login",
    JSON.stringify({ state, code_verifier }),
  );

  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.append("client_id", "ue88m41qxljoudx");
  url.searchParams.append("redirect_uri", `${window.location.origin}/`);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("code_challenge", code_challenge);
  url.searchParams.append("code_challenge_method", "S256");
  url.searchParams.append("token_access_type", "offline");
  url.searchParams.append("state", `dropbox-auth-state:${state}`);
  window.open(url, "_self");
}

export async function completeLogin(state: string, code: string | null) {
  const storedJson = localStorage.getItem("dropbox-oauth-login");
  localStorage.removeItem("dropbox-oauth-login");
  const stored = storedJson ? JSON.parse(storedJson) : null;

  if (stored === null || stored.state != state || code === null) {
    window.open(window.location.origin, "_self");
    return;
  }

  const url = new URL("https://api.dropbox.com/oauth2/token");
  const resp = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: `${window.location.origin}/`,
      code_verifier: stored.code_verifier,
      client_id: "ue88m41qxljoudx",
    }),
  });
  const data = await resp.json();
  localStorage.setItem("dropbox-oauth", JSON.stringify(data));
  window.open(`${window.location.origin}#settings-dropbox`, "_self");
}

function getOauthData(): OAuthData | undefined {
  const serialized = localStorage.getItem("dropbox-oauth");
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

export async function refreshAccessToken(): Promise<string | undefined> {
  const storedData = getOauthData();
  if (storedData === undefined) {
    return undefined;
  }
  const url = new URL("https://api.dropbox.com/oauth2/token");
  const resp = await fetch(url, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: storedData.refresh_token,
      client_id: "ue88m41qxljoudx",
    }),
  });
  const data = await resp.json();
  localStorage.setItem(
    "dropbox-oauth",
    JSON.stringify({
      ...storedData,
      access_token: data.access_token,
    }),
  );
  return data.access_token;
}
