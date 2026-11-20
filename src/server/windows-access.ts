import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const resolvers = new Map<string, JWTVerifyGetKey>();

export async function ownerAssertion(
  token: string | null,
  teamDomain?: string,
  audience?: string,
  owner?: string,
  testKeys?: JWTVerifyGetKey,
) {
  if (!token || !teamDomain || !audience || !owner ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/.test(teamDomain)) return false;
  const issuer = "https://" + teamDomain;
  let keys = testKeys ?? resolvers.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer));
    resolvers.set(issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience, algorithms: ["RS256"], requiredClaims: ["exp", "email"],
    });
    return typeof payload.email === "string" &&
      payload.email.toLowerCase() === owner.trim().toLowerCase();
  } catch {
    return false;
  }
}
