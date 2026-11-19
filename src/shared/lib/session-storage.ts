// Optional per-browser-tab UI state; blocked/full storage must never prevent a send.
export function loadLocal<T>(key: string, fallback: T): T {
  try {
    return (
      JSON.parse(sessionStorage.getItem("gts:" + key) ?? "null") ?? fallback
    );
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown) {
  try {
    sessionStorage.setItem("gts:" + key, JSON.stringify(value));
  } catch {
    /* Ephemeral browsing. */
  }
}
