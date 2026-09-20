export type GarminErrorCode =
  | "AUTH"
  | "MFA"
  | "NETWORK"
  | "UNCERTAIN"
  | "REJECTED"
  | "RATE_LIMIT"
  | "VAULT";

/** Only fixed, public messages enter this error: never include upstream bodies. */
export class GarminError extends Error {
  readonly uncertain: boolean;
  readonly definite: boolean;
  readonly retryable: boolean;
  constructor(readonly code: GarminErrorCode, message: string) {
    super(message);
    this.name = "GarminError";
    this.uncertain = code === "UNCERTAIN";
    this.definite = !this.uncertain;
    this.retryable = code === "NETWORK" || code === "RATE_LIMIT";
  }
}
