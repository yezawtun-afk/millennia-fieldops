// A small offline species list for the Millennia Village area. Workers can pick
// a name here or type their own; the catalog is a shortcut, not a restriction.
//
// `status` is the invasive check shown beside a species in the app. It is kept
// here rather than asked of the AI: a plant name from a photo is uncertain, but
// whether a known species belongs here is a fixed fact about the site.
//
// - native: evolved in Peninsular Malaysia.
// - introduced: planted or arrived with people, and does not usually spread on
//   its own (oil palm, rubber, bamboo).
// - invasive: an alien species that spreads into disturbed or natural ground
//   and out-competes what belongs there.
//
// Imperata cylindrica (lalang) is deliberately "native": it is an aggressive
// weed, but it is not an alien invader, and the pill answers that question.
export type SpeciesStatus = "native" | "introduced" | "invasive";

export interface SpeciesEntry {
  scientific: string;
  common: string;
  malay?: string;
  chinese?: string;
  status: SpeciesStatus;
}

export const SPECIES_CATALOG: SpeciesEntry[] = [
  {
    scientific: "Dicranopteris linearis",
    common: "False staghorn fern",
    malay: "Paku resam",
    chinese: "芒萁",
    status: "native",
  },
  {
    scientific: "Imperata cylindrica",
    common: "Cogon grass",
    malay: "Lalang",
    chinese: "白茅",
    status: "native",
  },
  {
    scientific: "Macaranga tanarius",
    common: "Macaranga",
    malay: "Mahang",
    chinese: "血桐",
    status: "native",
  },
  {
    scientific: "Ficus fistulosa",
    common: "Common red stem fig",
    malay: "Ara",
    chinese: "水同木",
    status: "native",
  },
  {
    scientific: "Melastoma malabathricum",
    common: "Singapore rhododendron",
    malay: "Senduduk",
    chinese: "野牡丹",
    status: "native",
  },
  {
    scientific: "Nephrolepis biserrata",
    common: "Giant sword fern",
    malay: "Paku pedang",
    chinese: "长叶肾蕨",
    status: "native",
  },
  {
    scientific: "Lygodium microphyllum",
    common: "Climbing fern",
    malay: "Paku kawat",
    chinese: "小叶海金沙",
    status: "native",
  },
  {
    scientific: "Mikania micrantha",
    common: "Mile-a-minute",
    malay: "Selaput tunggul",
    chinese: "微甘菊",
    status: "invasive",
  },
  {
    scientific: "Chromolaena odorata",
    common: "Siam weed",
    malay: "Pokok kapal terbang",
    chinese: "飞机草",
    status: "invasive",
  },
  {
    scientific: "Acacia mangium",
    common: "Mangium",
    malay: "Mangium",
    chinese: "马占相思",
    status: "introduced",
  },
  {
    scientific: "Hevea brasiliensis",
    common: "Rubber tree",
    malay: "Pokok getah",
    chinese: "橡胶树",
    status: "introduced",
  },
  {
    scientific: "Elaeis guineensis",
    common: "Oil palm",
    malay: "Kelapa sawit",
    chinese: "油棕",
    status: "introduced",
  },
  {
    scientific: "Musa spp.",
    common: "Banana",
    malay: "Pisang",
    chinese: "香蕉",
    status: "native",
  },
  {
    scientific: "Bambusa vulgaris",
    common: "Common bamboo",
    malay: "Buluh",
    chinese: "龙头竹",
    status: "introduced",
  },
  {
    scientific: "Scirpus grossus",
    common: "Greater club-rush",
    malay: "Rumput menderong",
    chinese: "粗根藨草",
    status: "native",
  },
  {
    scientific: "Lepironia articulata",
    common: "Grey sedge",
    malay: "Rumput purun",
    chinese: "节藨草",
    status: "native",
  },
  {
    scientific: "Pandanus amaryllifolius",
    common: "Pandan",
    malay: "Pandan",
    chinese: "香露兜",
    status: "introduced",
  },
  {
    scientific: "Alpinia galanga",
    common: "Greater galangal",
    malay: "Lengkuas",
    chinese: "大高良姜",
    status: "native",
  },
  {
    scientific: "Cynodon dactylon",
    common: "Bermuda grass",
    malay: "Rumput Bermuda",
    chinese: "狗牙根",
    status: "native",
  },
  {
    scientific: "Paspalum conjugatum",
    common: "Sourgrass",
    malay: "Rumput kerbau",
    chinese: "两耳草",
    status: "introduced",
  },
];

export function matchesSpecies(entry: SpeciesEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.scientific, entry.common, entry.malay, entry.chinese]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle));
}

// Exact lookup, not a search: "Ficus sp." from the AI is not "Ficus fistulosa",
// and claiming a status for a plant we only know to genus level would be a
// guess dressed up as a fact.
export function findSpeciesEntry(name: string | null | undefined): SpeciesEntry | null {
  if (!name) return null;
  const needle = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!needle) return null;
  return (
    SPECIES_CATALOG.find((entry) =>
      [entry.scientific, entry.common, entry.malay, entry.chinese]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase() === needle)
    ) ?? null
  );
}

export function speciesStatusFor(name: string | null | undefined): SpeciesStatus | null {
  return findSpeciesEntry(name)?.status ?? null;
}
