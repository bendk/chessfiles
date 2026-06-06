import * as dropbox from "./dropbox";
import * as lichess from "./lichess";

export { dropbox, lichess };

export function completeLogin(): boolean {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state");
  if (state && state.startsWith("dropbox-auth-state:")) {
    dropbox.completeLogin(state.split(":")[1], params.get("code"));
    return true;
  } else if (state && state.startsWith("lichess-auth-state:")) {
    lichess.completeLogin(state.split(":")[1], params.get("code"));
    return true;
  }
  return false;
}
