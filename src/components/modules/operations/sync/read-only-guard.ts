/** What the live-data layer is showing: no database, a database that couldn't be read, or live data. */
export type LiveKind = "off" | "error" | "live";

/**
 * Whether Operations' writes are held, so nothing goes back to Monday or HubSpot during the Dash Sync hold.
 *
 * They are held whenever a database is configured, which includes the error state: a deployment meant to be read
 * only mustn't run a sample sync that says "Monday and HubSpot updated" just because the read failed. Only with no
 * database (the prototype, where there is nothing to protect) do the sample writes run.
 */
export function writesHeld(kind: LiveKind): boolean {
  return kind !== "off";
}
