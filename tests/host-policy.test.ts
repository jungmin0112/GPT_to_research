import { expect, test } from "vitest";
import { allowHost } from "../src/server/host-policy";
test("원격 플랜은 지정된 HTTPS origin과 소유자 앱만 허용", () => {
  const host = "research.example.org",
    origin = "https://" + host;
  const check = (
    input: string | null,
    route = "sessions/id/chat",
    mock = false,
    configured = origin,
  ) => allowHost(host, input, true, route, mock, configured);
  expect(check(origin)).toBe(true);
  for (const invalid of [null, "http://" + host, "https://else.example"])
    expect(check(invalid)).toBe(false);
  expect(check(origin, "plan/login")).toBe(false);
  expect(check(origin, "projects", true)).toBe(false);
  expect(check(origin, "projects", false, origin + "/foo")).toBe(false);
  expect(
    allowHost("else.example", null, false, "projects", false, origin),
  ).toBe(false);
  expect(allowHost("127.0.0.1:3000", null, false, "projects", true)).toBe(true);
});
