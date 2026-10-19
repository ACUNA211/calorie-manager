// Scan on the Shopping list (ticket #49). Pure rules: which list line a scanned food ticks.
// A line is open when it is not ticked and not waiting to be added (a queued hand line has no id
// the database knows yet). Lines are the shapes lineFromRow gives, with the queued ones from
// withQueued.

// The open line a scanned food ticks, or null. A food can have several (the plan line and a
// "+ extra" line from a plan that grew): the planned line goes first, then the oldest.
export function matchLine(lines, foodId) {
  if (foodId === null || foodId === undefined) return null;
  const open = lines.filter(
    (line) => line.foodId !== null && Number(line.foodId) === Number(foodId) && isOpen(line)
  );
  if (open.length === 0) return null;
  const rank = (line) => (line.source === 'plan_extra' ? 1 : 0);
  return [...open].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      String(a.addedAt ?? '').localeCompare(String(b.addedAt ?? '')) ||
      a.id - b.id
  )[0];
}

function isOpen(line) {
  return !line.purchased && !line.pending && typeof line.id === 'number';
}

// What a scan of this food does: tick a line ('tick', with the line), or, with no open line,
// offer the Pantry ('offer'). `alreadyTicked` is true when the food has lines but all are done,
// so the screen can say so instead of "not on the list".
export function scanPlan(lines, foodId) {
  const line = matchLine(lines, foodId);
  if (line) return { kind: 'tick', line };
  const alreadyTicked = lines.some(
    (entry) => entry.foodId !== null && Number(entry.foodId) === Number(foodId) && entry.purchased
  );
  return { kind: 'offer', alreadyTicked };
}
