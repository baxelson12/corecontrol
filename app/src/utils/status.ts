import { invoke } from "@tauri-apps/api/core";
import { match, P } from "ts-pattern";

/** Live speed and duty readings for the three cooling channels. */
export interface FanReadings {
  /** Speed of the first radiator fan in RPM. */
  readonly radiatorRpm: number;
  /** Duty of the radiator fan channel, in percent (0–100). */
  readonly radiatorDuty: number;
  /** Waterblock fan speed in RPM. */
  readonly waterblockRpm: number;
  /** Duty of the waterblock fan channel, in percent (0–100). */
  readonly waterblockDuty: number;
  /** Pump speed in RPM. */
  readonly pumpRpm: number;
  /** Duty of the pump channel, in percent (0–100). */
  readonly pumpDuty: number;
}

/** Shape a raw IPC reply must have to count as `FanReadings`. */
const readingsPattern = P.shape({
  radiatorRpm: P.number.int().gte(0),
  radiatorDuty: P.number.int().between(0, 100),
  waterblockRpm: P.number.int().gte(0),
  waterblockDuty: P.number.int().between(0, 100),
  pumpRpm: P.number.int().gte(0),
  pumpDuty: P.number.int().between(0, 100),
});

/**
 * Reads one status report from the opened cooler. Folds failures (no cooler
 * open, device read error, malformed reply) into `null` so a polling loop
 * can skip a bad tick and keep going. Never throws.
 *
 * @returns The readings, or `null` when this tick produced none.
 */
export async function readFanStatus(): Promise<FanReadings | null> {
  try {
    const reply: unknown = await invoke("fan_status");
    return match<unknown, FanReadings | null>(reply)
      .with(readingsPattern, (readings) => readings)
      .otherwise(() => null);
  } catch (error) {
    console.error("fan status read failed:", error);
    return null;
  }
}
