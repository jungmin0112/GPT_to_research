import { expect, test } from "vitest";
import { generateKeyPair, SignJWT } from "jose";
import { ownerAssertion } from "../src/server/windows-access";

test("Windows host accepts only the signed, current owner assertion for this Access app", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const team = "example.cloudflareaccess.com";
  const owner = "owner@example.org";
  const sign = (email: string, aud: string, exp: string) =>
    new SignJWT({ email }).setProtectedHeader({ alg: "RS256" })
      .setIssuer("https://" + team).setAudience(aud)
      .setExpirationTime(exp).sign(privateKey);
  const check = (token: string | null, domain = team) =>
    ownerAssertion(token, domain, "this-app", owner, async () => publicKey);
  const valid = await sign(owner, "this-app", "1h");
  expect(await check(valid)).toBe(true);
  for (const token of [null, valid + "invalid", await sign("other@example.org", "this-app", "1h"),
    await sign(owner, "other", "1h"), await sign(owner, "this-app", "-1h")])
    expect(await check(token)).toBe(false);
  expect(await check(valid, "foreign.cloudflareaccess.com")).toBe(false);
  expect(await check(valid, "")).toBe(false);
});
