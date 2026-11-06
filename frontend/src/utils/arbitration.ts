import type { MatchPair } from "../types";

export function getPendingArbitrationMatches(matches: MatchPair[]): MatchPair[] {
  const duplicateIds = new Set<string>();
  const resolvedIds = new Set<string>();

  matches.forEach((match) => {
    const ids = [match.recordA?.id, match.recordB?.id]
      .filter((id): id is string => Boolean(id))
      .map(String);
    if (match.decision) ids.forEach((id) => resolvedIds.add(id));
    if (match.status === "duplicate" || (match.status === "uncertain" && match.decision === "confirmed")) {
      ids.forEach((id) => duplicateIds.add(id));
    }
  });

  const candidates = matches
    .filter((match) => match.status === "uncertain" && !match.decision)
    .slice()
    .sort((a, b) => b.score - a.score);
  const assignedIds = new Set<string>();
  const selected: MatchPair[] = [];

  candidates.forEach((match) => {
    const availableIds = [match.recordA?.id, match.recordB?.id]
      .filter((id): id is string => Boolean(id))
      .map(String)
      .filter((id) => !duplicateIds.has(id) && !resolvedIds.has(id));
    if (!availableIds.some((id) => !assignedIds.has(id))) return;
    selected.push(match);
    availableIds.forEach((id) => assignedIds.add(id));
  });

  return selected;
}