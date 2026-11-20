export type JournalChange =
  | { type: "author"; authorId: string }
  | { type: "country"; country: string }
  | { type: "city"; country: string; city: string }
  | { type: "all" }
  | { type: "home"; authorId?: string }
  | { type: "order"; order: "asc" | "desc" }
  | { type: "toggle-delete" };

export function buildJournalUrl(search: string, change: JournalChange): string {
  const next = new URLSearchParams(search);
  switch (change.type) {
    case "author":
      next.set("author", change.authorId);
      next.delete("country");
      next.delete("city");
      next.delete("delete");
      next.set("all", "true");
      break;
    case "country":
      next.delete("all");
      next.delete("city");
      next.set("country", change.country);
      break;
    case "city":
      next.delete("all");
      next.set("country", change.country);
      next.set("city", change.city);
      break;
    case "all":
      next.delete("country");
      next.delete("city");
      next.set("all", "true");
      break;
    case "home":
      return change.authorId
        ? `/?author=${encodeURIComponent(change.authorId)}`
        : "/";
    case "order":
      next.set("order", change.order);
      break;
    case "toggle-delete":
      if (next.get("delete") === "1") next.delete("delete");
      else next.set("delete", "1");
      break;
  }
  const query = next.toString();
  return query ? `/?${query}` : "/";
}
