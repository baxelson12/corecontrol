import { match, P } from 'ts-pattern';

/** Latest-release endpoint of the app's GitHub repository. */
const LATEST_RELEASE_URL = 'https://api.github.com/repos/baxelson12/corecontrol/releases/latest';

/** How long the release lookup may take before it is abandoned. */
const FETCH_TIMEOUT_MS = 10_000;

/** A version split into its numeric parts, major first. */
type VersionParts = readonly [number, number, number];

/** Parses `x.y.z` into numeric parts. */
function parseVersion(text: string): VersionParts | null {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(text);
  const [, major, minor, patch] = parts ?? [];
  if (major === undefined || minor === undefined || patch === undefined) {
    return null;
  }
  return [Number(major), Number(minor), Number(patch)];
}

/**
 * Whether `candidate` is a strictly newer version than `current`. Malformed
 * versions on either side count as "not newer", so a bad tag never nags.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (a === null || b === null) {
    return false;
  }
  const [aMajor, aMinor, aPatch] = a;
  const [bMajor, bMinor, bPatch] = b;
  if (aMajor !== bMajor) {
    return aMajor > bMajor;
  }
  if (aMinor !== bMinor) {
    return aMinor > bMinor;
  }
  return aPatch > bPatch;
}

/**
 * Asks GitHub for the newest released version, e.g. `0.3.0`.
 *
 * @returns The version with any leading `v` stripped, or `null` when the
 * lookup fails, times out, or the reply has no usable tag. Never throws.
 */
export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(LATEST_RELEASE_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return match(body)
      .with({ tag_name: P.select(P.string) }, (tag) => tag.replace(/^v/, ''))
      .otherwise(() => null);
  } catch {
    return null;
  }
}
