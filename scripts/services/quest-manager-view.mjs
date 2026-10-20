/** Pure presentation helpers. Never mutate Quest documents or Actor progress. */
export const QUEST_CATEGORIES = Object.freeze(["all","gm","available","accepted","finished"]);

/** Folders reflect global status; this view optionally divides Available Quests by pending Characters. */
export function questCategory(status, pendingCharacters = 0) {
  if (status === "inactive") return "finished";
  if (status !== "available") return "gm";
  return Number(pendingCharacters) > 0 ? "accepted" : "available";
}

export function normalizeQuestSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

export function questMatches(entry, query = "") {
  const needle = normalizeQuestSearch(query);
  return !needle || normalizeQuestSearch(`${entry.name ?? ""} ${entry.faction ?? ""}`).includes(needle);
}

export function questCategoryCounts(entries, query = "") {
  const counts = Object.fromEntries(QUEST_CATEGORIES.map(category => [category,0]));
  for (const entry of entries) {
    if (!questMatches(entry,query)) continue;
    counts.all++;
    if (Object.hasOwn(counts,entry.category)) counts[entry.category]++;
  }
  return counts;
}
