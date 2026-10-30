"use client";

// Marks a list row that has only just arrived from the phone.
//
// The web dashboard refreshes itself every ten seconds (AutoRefresh), so a new
// record can appear under a supervisor's eyes without them noticing. This gives
// it a soft green wash for a moment, then gets out of the way.
//
// Why a provider and not per-row state: the rows are rendered on the server, so
// a row cannot know what the previous list looked like. FreshRows holds the
// previous ids and answers "is this one new?" for the rows inside it. Its state
// survives router.refresh(), which is what makes the comparison possible in the
// first place.
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** How long the wash stays on a row that just appeared. */
const FLASH_MS = 1600;

const FreshIdsContext = createContext<ReadonlySet<string>>(new Set<string>());

export function FreshRows({ ids, children }: { ids: string[]; children: ReactNode }) {
  // `ids` is a fresh array on every render, so compare on its contents instead.
  const signature = ids.join(",");
  const latest = useRef(ids);
  latest.current = ids;

  const previous = useRef<string[] | null>(null);
  const [fresh, setFresh] = useState<string[]>([]);

  useEffect(() => {
    const before = previous.current;
    previous.current = latest.current;

    // First paint is not news: everything on a freshly loaded page is "old".
    if (!before) return;

    const added = latest.current.filter((id) => !before.includes(id));
    if (added.length === 0) return;

    setFresh(added);
    const timer = window.setTimeout(() => setFresh([]), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [signature]);

  const value = useMemo(() => new Set(fresh), [fresh]);

  return <FreshIdsContext.Provider value={value}>{children}</FreshIdsContext.Provider>;
}

/** True while the row's id is one that has just appeared in this list. */
export function useFreshId(id: string): boolean {
  return useContext(FreshIdsContext).has(id);
}
