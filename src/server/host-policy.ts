// The reverse proxy must preserve Host and forward only its configured TLS site.
export function allowHost(
  host: string,
  origin: string | null,
  post: boolean,
  route: string,
  mock: boolean,
  configured?: string,
) {
  if (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)) return true;
  if (!configured || mock || route === "plan/login") return false;
  try {
    const url = new URL(configured);
    return (
      url.protocol === "https:" &&
      configured.replace(/\/$/, "") === url.origin &&
      host === url.host &&
      (!post || origin === url.origin)
    );
  } catch {
    return false;
  }
}
