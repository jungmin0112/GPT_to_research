// In-process fixture for the workerd integration test, with no network route.
const auth = {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (request.headers.get("apikey") !== "test-publishable")
      return new Response(null, { status: 403 });
    if (path === "/auth/v1/token")
      return Response.json({
        user: { id: "test-owner" },
        access_token: "test-access",
        refresh_token: "test-refresh",
        expires_in: 3600,
      });
    if (request.headers.get("Authorization") !== "Bearer test-access")
      return new Response(null, { status: 401 });
    if (path === "/auth/v1/user") return Response.json({ id: "test-owner" });
    if (path === "/rest/v1/rpc/project_list")
      return Response.json([{ name: "research-test" }]);
    return new Response(null, { status: 404 });
  },
};
export default auth;
