/** Collect only distributable artifacts, never local application data. */
const [installer, platform] = Deno.args;
if (!installer || !["macos-arm64", "windows-x64"].includes(platform)) {
  throw new Error("Expected installer path and supported release platform");
}
const extension = platform === "macos-arm64" ? "zip" : "msi";
const name = `RideRelay-${platform}.${extension}`;
const bytes = await Deno.readFile(installer);
if (!bytes.length) throw new Error("Empty installer");
const hash = Array.from(
  new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
)
  .map((byte) => byte.toString(16).padStart(2, "0")).join("");
await Deno.mkdir("dist/release", { recursive: true });
await Deno.writeFile(`dist/release/${name}`, bytes);
await Deno.writeTextFile(`dist/release/${name}.sha256`, `${hash}  ${name}\n`);
console.log(`Prepared ${name} (${bytes.length} bytes) and SHA-256 checksum`);
