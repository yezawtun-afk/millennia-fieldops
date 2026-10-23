// A small offline species list for the Millennia Village area. Workers can pick
// a name here or type their own; the catalog is a shortcut, not a restriction.
export interface SpeciesEntry {
  scientific: string;
  common: string;
  malay?: string;
  chinese?: string;
}

export const SPECIES_CATALOG: SpeciesEntry[] = [
  {
    scientific: "Dicranopteris linearis",
    common: "False staghorn fern",
    malay: "Paku resam",
    chinese: "芒萁",
  },
  {
    scientific: "Imperata cylindrica",
    common: "Cogon grass",
    malay: "Lalang",
    chinese: "白茅",
  },
  {
    scientific: "Macaranga tanarius",
    common: "Macaranga",
    malay: "Mahang",
    chinese: "血桐",
  },
  {
    scientific: "Ficus fistulosa",
    common: "Common red stem fig",
    malay: "Ara",
    chinese: "水同木",
  },
  {
    scientific: "Melastoma malabathricum",
    common: "Singapore rhododendron",
    malay: "Senduduk",
    chinese: "野牡丹",
  },
  {
    scientific: "Nephrolepis biserrata",
    common: "Giant sword fern",
    malay: "Paku pedang",
    chinese: "长叶肾蕨",
  },
  {
    scientific: "Lygodium microphyllum",
    common: "Climbing fern",
    malay: "Paku kawat",
    chinese: "小叶海金沙",
  },
  {
    scientific: "Mikania micrantha",
    common: "Mile-a-minute",
    malay: "Selaput tunggul",
    chinese: "微甘菊",
  },
  {
    scientific: "Chromolaena odorata",
    common: "Siam weed",
    malay: "Pokok kapal terbang",
    chinese: "飞机草",
  },
  {
    scientific: "Acacia mangium",
    common: "Mangium",
    malay: "Mangium",
    chinese: "马占相思",
  },
  {
    scientific: "Hevea brasiliensis",
    common: "Rubber tree",
    malay: "Pokok getah",
    chinese: "橡胶树",
  },
  {
    scientific: "Elaeis guineensis",
    common: "Oil palm",
    malay: "Kelapa sawit",
    chinese: "油棕",
  },
  {
    scientific: "Musa spp.",
    common: "Banana",
    malay: "Pisang",
    chinese: "香蕉",
  },
  {
    scientific: "Bambusa vulgaris",
    common: "Common bamboo",
    malay: "Buluh",
    chinese: "龙头竹",
  },
  {
    scientific: "Scirpus grossus",
    common: "Greater club-rush",
    malay: "Rumput menderong",
    chinese: "粗根藨草",
  },
  {
    scientific: "Lepironia articulata",
    common: "Grey sedge",
    malay: "Rumput purun",
    chinese: "节藨草",
  },
  {
    scientific: "Pandanus amaryllifolius",
    common: "Pandan",
    malay: "Pandan",
    chinese: "香露兜",
  },
  {
    scientific: "Alpinia galanga",
    common: "Greater galangal",
    malay: "Lengkuas",
    chinese: "大高良姜",
  },
  {
    scientific: "Cynodon dactylon",
    common: "Bermuda grass",
    malay: "Rumput Bermuda",
    chinese: "狗牙根",
  },
  {
    scientific: "Paspalum conjugatum",
    common: "Sourgrass",
    malay: "Rumput kerbau",
    chinese: "两耳草",
  },
];

export function matchesSpecies(entry: SpeciesEntry, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.scientific, entry.common, entry.malay, entry.chinese]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle));
}
