export type Language = "auto" | "de" | "en";
export interface Settings {
  language: Language;
  sourceDir: string;
  backupDir: string;
  autoSync: boolean;
  notifySuccess: boolean;
  notifyFailure: boolean;
}
export type ActivityStatus =
  | "ready"
  | "syncing"
  | "synced"
  | "duplicate"
  | "failed"
  | "uncertain";
export interface Activity {
  id: string;
  hash: string;
  name: string;
  sourcePath: string;
  backupPath: string | null;
  startedAt: string;
  duration: number;
  distance: number;
  avgPower: number | null;
  avgHeartRate: number | null;
  avgCadence: number | null;
  status: ActivityStatus;
  attempts: number;
  error: string | null;
  garminId: string | null;
  syncedAt: string | null;
}
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clientId: string;
}
export interface TokenStore {
  load(): Promise<SessionTokens | null>;
  save(tokens: SessionTokens): Promise<void>;
  clear(): Promise<void>;
}
export interface GarminAdapter {
  findActivity?(
    activity: Pick<Activity, "startedAt" | "duration" | "distance">,
  ): Promise<string | null>;
  connected(): Promise<boolean>;
  login(
    email: string,
    password: string,
    mfa: () => Promise<string>,
  ): Promise<void>;
  profile(): Promise<{ displayName: string }>;
  logout(): Promise<void>;
  upload(
    bytes: Uint8Array,
    filename: string,
  ): Promise<{ duplicate: boolean; activityId: string | null }>;
}
export interface Snapshot {
  settings: Settings;
  activities: Activity[];
  connected: boolean;
  sourceExists: boolean;
  scanning: boolean;
  demo: boolean;
}
export interface SyncService {
  snapshot(): Promise<Snapshot>;
  scan(): Promise<Activity[]>;
  reconcile(id?: string): Promise<Activity[]>;
  saveSettings(settings: Partial<Settings>): Promise<Settings>;
  sync(id?: string): Promise<Activity[]>;
  watch(signal: AbortSignal): Promise<void>;
  close(): void;
}
