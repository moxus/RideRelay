import { Encoder } from "@garmin/fitsdk";
/** Deterministic synthetic cycling FIT, containing no personal data. */
export function syntheticFit(
  start = new Date("2026-09-20T08:00:00Z"),
  samplePower = 180,
): Uint8Array {
  const encoder = new Encoder();
  const write = (num: number, fields: Record<string, unknown>) =>
    encoder.onMesg(num, { mesgNum: num, ...fields });
  write(0, {
    type: "activity",
    manufacturer: "development",
    product: 1,
    timeCreated: start,
    serialNumber: 1,
  });
  for (let i = 0; i < 10; i++) {
    write(20, {
      timestamp: new Date(start.getTime() + i * 1000),
      power: samplePower + i,
      heartRate: 130,
      cadence: 85,
      distance: i * 10,
    });
  }
  write(18, {
    timestamp: new Date(start.getTime() + 10_000),
    startTime: start,
    sport: "cycling",
    subSport: "indoorCycling",
    totalTimerTime: 10,
    totalElapsedTime: 10,
    totalDistance: 100,
    avgPower: 185,
    avgHeartRate: 130,
    avgCadence: 85,
  });
  write(34, {
    timestamp: new Date(start.getTime() + 10_000),
    totalTimerTime: 10,
    numSessions: 1,
    type: "manual",
  });
  return encoder.close();
}
