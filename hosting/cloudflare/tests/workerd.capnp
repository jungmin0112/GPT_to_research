using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name="research", worker=(
      modules=[(name="worker.mjs",esModule=embed "../worker.mjs")],
      compatibilityDate="2026-11-19",
      bindings=[
        (name="SUPABASE_URL",text="https://test.invalid"),
        (name="SUPABASE_PUBLISHABLE_KEY",text="test-publishable"),
        (name="OWNER_USER_ID",text="test-owner")],
      globalOutbound="mock-auth")),
    (name="mock-auth",worker=(
      modules=[(name="mock-auth.mjs",esModule=embed "mock-auth.mjs")],
      compatibilityDate="2026-11-19"))],
  sockets=[(name="http",address="127.0.0.1:18818",http=(),service="research")]);
