/** Explicit disposable OS-vault check. Never reads or writes the real Garmin account. */
import { OsTokenStore } from "./mod.ts";

if (import.meta.main) {
  const store = new OsTokenStore(`smoke-${crypto.randomUUID()}`);
  try {
    if (await store.load() !== null) throw new Error("Namespace is not empty");
    await store.save({
      accessToken: "synthetic-access",
      refreshToken: "synthetic-refresh",
      clientId: "synthetic-client",
      expiresAt: 1,
    });
    if ((await store.load())?.accessToken !== "synthetic-access") {
      throw new Error("Vault readback failed");
    }
    await store.save({
      accessToken: "synthetic-updated",
      refreshToken: "synthetic-refresh",
      clientId: "synthetic-client",
      expiresAt: 2,
    });
    if ((await store.load())?.accessToken !== "synthetic-updated") {
      throw new Error("Vault update failed");
    }
  } finally {
    await store.clear();
  }
  if (await store.load() !== null) throw new Error("Vault cleanup failed");
  console.log(
    "Native vault: save, read, update, delete verified with disposable synthetic data.",
  );
}
