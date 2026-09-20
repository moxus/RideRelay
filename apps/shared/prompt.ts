import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import process from "node:process";

export function createPrompt() {
  if (!Deno.stdin.isTerminal()) {
    throw new Error("Die Anmeldung braucht ein interaktives Terminal.");
  }
  let hidden = false;
  const out = new Writable({
    write(chunk, _encoding, done) {
      if (!hidden) process.stdout.write(chunk);
      done();
    },
  });
  const rl = createInterface({
    input: process.stdin,
    output: out,
    terminal: true,
  });
  return {
    async ask(label: string, secret = false) {
      process.stdout.write(label);
      hidden = secret;
      try {
        const value = await rl.question("");
        if (secret) process.stdout.write("\n");
        return value;
      } finally {
        hidden = false;
      }
    },
    close() {
      rl.close();
    },
  };
}
