export type LatestReleaseInfo = { version: string; notes?: string; pub_date?: string };
/** 0.1.0 is a development baseline; no release has been published. */
export async function fetchLatestReleaseInfo(): Promise<LatestReleaseInfo | null> { return null; }
