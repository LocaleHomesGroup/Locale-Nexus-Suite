/**
 * Finance › Overview — SAMPLE FIGURES. The health check doesn't report yet:
 * nothing records how many clients start it, finish it or stop part-way. These
 * placeholders show what its Overview will carry once Mercury does, and every
 * card that uses one says "Sample" in its supporting line. Replace them with
 * real counts; don't build on them.
 */
export const HEALTH_CHECK_SAMPLE = {
  /** Clients who opened the form in August. */
  started: 38,
  completed: 24,
  /** The step most clients stopped at, its name, and how many stopped there. */
  dropOffStep: 2,
  dropOffName: "Income",
  droppedThere: 9,
  savedToMercury: 24,
  failedWrites: 0,
  /** Median minutes from step 1 to step 5. */
  medianMinutes: 8,
  /** Broker appointments booked from completed checks. */
  brokerFollowUps: 11,
} as const;
