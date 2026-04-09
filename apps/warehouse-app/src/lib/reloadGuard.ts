const WINDOW_NAME_PREFIX = "__popclozet_reload__:";

function getWindowNameTokens(): string[] {
  if (typeof window === "undefined") return [];

  return window.name
    .split("|")
    .map((token) => token.trim())
    .filter(Boolean);
}

function setWindowNameTokens(tokens: string[]) {
  if (typeof window === "undefined") return;
  window.name = tokens.join("|");
}

function getWindowNameKey(key: string) {
  return `${WINDOW_NAME_PREFIX}${key}`;
}

export function hasReloadGuard(key: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return getWindowNameTokens().includes(getWindowNameKey(key));
  }
}

export function setReloadGuard(key: string) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(key, "1");
    return;
  } catch {
    const tokens = getWindowNameTokens();
    const windowNameKey = getWindowNameKey(key);

    if (!tokens.includes(windowNameKey)) {
      tokens.push(windowNameKey);
      setWindowNameTokens(tokens);
    }
  }
}
