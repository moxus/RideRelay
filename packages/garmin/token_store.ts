import type { SessionTokens, TokenStore } from "../contracts/mod.ts";
import { GarminError } from "./errors.ts";

function openLibrary<const T extends Deno.ForeignLibraryInterface>(
  path: string,
  symbols: T,
) {
  const library = Deno.dlopen(path, symbols);
  return { symbols: library.symbols, [Symbol.dispose]: () => library.close() };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function vaultError(): GarminError {
  return new GarminError(
    "VAULT",
    "Der sichere Anmeldespeicher ist nicht verfügbar oder gesperrt.",
  );
}
function decode(bytes: Uint8Array): SessionTokens {
  try {
    const value = JSON.parse(decoder.decode(bytes));
    if (
      typeof value.accessToken !== "string" || !value.accessToken ||
      typeof value.refreshToken !== "string" || !value.refreshToken ||
      typeof value.clientId !== "string" || !value.clientId ||
      typeof value.expiresAt !== "number" || !Number.isFinite(value.expiresAt)
    ) throw vaultError();
    return {
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
      clientId: value.clientId,
      expiresAt: value.expiresAt,
    };
  } catch {
    throw vaultError();
  }
}

/** Explicit opt-in for tests or an ephemeral session; never a vault fallback. */
export class MemoryTokenStore implements TokenStore {
  #tokens: SessionTokens | null = null;
  load(): Promise<SessionTokens | null> {
    return Promise.resolve(this.#tokens ? { ...this.#tokens } : null);
  }
  save(tokens: SessionTokens): Promise<void> {
    this.#tokens = { ...tokens };
    return Promise.resolve();
  }
  clear(): Promise<void> {
    this.#tokens = null;
    return Promise.resolve();
  }
}

/** Native OS vault. Requires --allow-ffi; no subprocesses, files or secret argv. */
export class OsTokenStore implements TokenStore {
  constructor(private account = "garmin", private service = "RideRelay") {
    if (!account || !service || /\0/.test(account + service)) {
      throw vaultError();
    }
  }
  #operate(
    operation: "load" | "save" | "clear",
    value?: SessionTokens,
  ): SessionTokens | null {
    const bytes = value ? encoder.encode(JSON.stringify(value)) : undefined;
    try {
      if (Deno.build.os === "darwin") return this.#mac(operation, bytes);
      if (Deno.build.os === "windows") return this.#windows(operation, bytes);
      throw new GarminError(
        "VAULT",
        "Der sichere Anmeldespeicher wird derzeit nur unter macOS und Windows unterstützt.",
      );
    } catch (error) {
      if (error instanceof GarminError) throw error;
      throw vaultError();
    } finally {
      bytes?.fill(0);
    }
  }
  load(): Promise<SessionTokens | null> {
    return Promise.resolve().then(() => this.#operate("load"));
  }
  async save(tokens: SessionTokens): Promise<void> {
    await Promise.resolve().then(() => this.#operate("save", tokens));
  }
  async clear(): Promise<void> {
    await Promise.resolve().then(() => this.#operate("clear"));
  }
  #mac(
    operation: "load" | "save" | "clear",
    bytes?: Uint8Array,
  ): SessionTokens | null {
    using security = openLibrary(
      "/System/Library/Frameworks/Security.framework/Security",
      {
        SecKeychainFindGenericPassword: {
          parameters: [
            "pointer",
            "u32",
            "buffer",
            "u32",
            "buffer",
            "buffer",
            "buffer",
            "buffer",
          ],
          result: "i32",
        },
        SecKeychainAddGenericPassword: {
          parameters: [
            "pointer",
            "u32",
            "buffer",
            "u32",
            "buffer",
            "u32",
            "buffer",
            "pointer",
          ],
          result: "i32",
        },
        SecKeychainItemModifyAttributesAndData: {
          parameters: ["pointer", "pointer", "u32", "buffer"],
          result: "i32",
        },
        SecKeychainItemDelete: { parameters: ["pointer"], result: "i32" },
        SecKeychainItemFreeContent: {
          parameters: ["pointer", "pointer"],
          result: "i32",
        },
      } as const,
    );
    using foundation = openLibrary(
      "/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation",
      {
        CFRelease: { parameters: ["pointer"], result: "void" },
      } as const,
    );
    const service = encoder.encode(this.service),
      account = encoder.encode(this.account);
    const size = new Uint32Array(1),
      data = new BigUint64Array(1),
      item = new BigUint64Array(1);
    const status = security.symbols.SecKeychainFindGenericPassword(
      null,
      service.length,
      service,
      account.length,
      account,
      size,
      data,
      item,
    );
    const itemPtr = Deno.UnsafePointer.create(item[0]);
    const dataPtr = Deno.UnsafePointer.create(data[0]);
    try {
      if (status !== 0 && status !== -25300) throw vaultError();
      if (operation === "load") {
        if (status === -25300) return null;
        if (!dataPtr || size[0] > 65536) throw vaultError();
        const copy = new Uint8Array(size[0]);
        try {
          new Deno.UnsafePointerView(dataPtr).copyInto(copy);
          return decode(copy);
        } finally {
          copy.fill(0);
        }
      }
      if (operation === "clear") {
        if (itemPtr && security.symbols.SecKeychainItemDelete(itemPtr) !== 0) {
          throw vaultError();
        }
        return null;
      }
      if (!bytes) throw vaultError();
      const saved = itemPtr
        ? security.symbols.SecKeychainItemModifyAttributesAndData(
          itemPtr,
          null,
          bytes.length,
          bytes,
        )
        : security.symbols.SecKeychainAddGenericPassword(
          null,
          service.length,
          service,
          account.length,
          account,
          bytes.length,
          bytes,
          null,
        );
      if (saved !== 0) throw vaultError();
      return null;
    } finally {
      if (dataPtr) security.symbols.SecKeychainItemFreeContent(null, dataPtr);
      if (itemPtr) foundation.symbols.CFRelease(itemPtr);
    }
  }
  #windows(
    operation: "load" | "save" | "clear",
    bytes?: Uint8Array,
  ): SessionTokens | null {
    // CREDENTIALW uses this ABI on Windows x64/arm64 (both 64-bit pointers).
    using advapi = openLibrary(
      "Advapi32.dll",
      {
        CredReadW: {
          parameters: ["buffer", "u32", "u32", "buffer"],
          result: "i32",
        },
        CredWriteW: { parameters: ["buffer", "u32"], result: "i32" },
        CredDeleteW: { parameters: ["buffer", "u32", "u32"], result: "i32" },
        CredFree: { parameters: ["pointer"], result: "void" },
      } as const,
    );
    using kernel = openLibrary(
      "Kernel32.dll",
      { GetLastError: { parameters: [], result: "u32" } } as const,
    );
    const wide = (value: string) =>
      Uint16Array.from([...value.split("").map((c) => c.charCodeAt(0)), 0]);
    const target = wide(`${this.service}/${this.account}`);
    if (operation === "clear") {
      if (
        !advapi.symbols.CredDeleteW(target, 1, 0) &&
        kernel.symbols.GetLastError() !== 1168
      ) throw vaultError();
      return null;
    }
    if (operation === "save") {
      if (!bytes || bytes.length > 2560) throw vaultError();
      const record = new Uint8Array(80), view = new DataView(record.buffer);
      const username = wide(this.account);
      view.setUint32(4, 1, true); // CRED_TYPE_GENERIC
      view.setBigUint64(
        8,
        Deno.UnsafePointer.value(Deno.UnsafePointer.of(target)),
        true,
      );
      view.setUint32(32, bytes.length, true);
      view.setBigUint64(
        40,
        Deno.UnsafePointer.value(Deno.UnsafePointer.of(bytes)),
        true,
      );
      view.setUint32(48, 2, true); // CRED_PERSIST_LOCAL_MACHINE, scoped to current user
      view.setBigUint64(
        72,
        Deno.UnsafePointer.value(Deno.UnsafePointer.of(username)),
        true,
      );
      if (!advapi.symbols.CredWriteW(record, 0)) throw vaultError();
      return null;
    }
    const result = new BigUint64Array(1);
    if (!advapi.symbols.CredReadW(target, 1, 0, result)) {
      if (kernel.symbols.GetLastError() === 1168) return null;
      throw vaultError();
    }
    const pointer = Deno.UnsafePointer.create(result[0]);
    if (!pointer) throw vaultError();
    try {
      const view = new Deno.UnsafePointerView(pointer);
      const length = view.getUint32(32), data = view.getPointer(40);
      if (!data || length > 2560) throw vaultError();
      const copy = new Uint8Array(length);
      try {
        new Deno.UnsafePointerView(data).copyInto(copy);
        return decode(copy);
      } finally {
        copy.fill(0);
      }
    } finally {
      advapi.symbols.CredFree(pointer);
    }
  }
}
