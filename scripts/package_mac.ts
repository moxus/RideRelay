// Explicit image capacity avoids hdiutil's undersized auto-calculation on CI.
if (Deno.build.os !== "darwin") {
  throw new Error("macOS packaging requires macOS");
}
const staging = await Deno.makeTempDir({ dir: "dist", prefix: "dmg-" });
async function copyTree(source: string, target: string): Promise<void> {
  await Deno.mkdir(target, { recursive: true });
  for await (const entry of Deno.readDir(source)) {
    const from = `${source}/${entry.name}`;
    const to = `${target}/${entry.name}`;
    if (entry.isDirectory) await copyTree(from, to);
    else if (entry.isSymlink) await Deno.symlink(await Deno.readLink(from), to);
    else {
      await Deno.copyFile(from, to);
      const mode = (await Deno.stat(from)).mode;
      if (mode !== null) await Deno.chmod(to, mode);
    }
  }
}
try {
  await copyTree("dist/RideRelay.app", `${staging}/RideRelay.app`);
  await Deno.symlink("/Applications", `${staging}/Applications`);
  const result = await new Deno.Command("hdiutil", {
    args: [
      "create",
      "-ov",
      "-volname",
      "RideRelay",
      "-fs",
      "HFS+",
      "-size",
      "256m",
      "-srcfolder",
      staging,
      "-format",
      "UDZO",
      "dist/RideRelay.dmg",
    ],
  }).spawn().status;
  if (!result.success) throw new Error("DMG creation failed");
} finally {
  await Deno.remove(staging, { recursive: true });
}
