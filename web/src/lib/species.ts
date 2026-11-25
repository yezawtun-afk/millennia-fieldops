// The invasive check for the species the app knows about.
//
// This mirrors mobile/src/lib/species.ts. It is duplicated rather than shared
// because the two apps are built and deployed separately; keep the statuses in
// step when a species is added. Nothing is guessed: a name that is not in this
// list (or is only identified to genus, such as "Ficus sp.") gets no label.
export type SpeciesStatus = "native" | "introduced" | "invasive";

export interface SpeciesStatusEntry {
  scientific: string;
  common: string;
  status: SpeciesStatus;
}

export const SPECIES_STATUS: SpeciesStatusEntry[] = [
  { scientific: "Dicranopteris linearis", common: "False staghorn fern", status: "native" },
  // Lalang is an aggressive weed but a native one, so it is not an alien invader.
  { scientific: "Imperata cylindrica", common: "Cogon grass", status: "native" },
  { scientific: "Macaranga tanarius", common: "Macaranga", status: "native" },
  { scientific: "Ficus fistulosa", common: "Common red stem fig", status: "native" },
  { scientific: "Melastoma malabathricum", common: "Singapore rhododendron", status: "native" },
  { scientific: "Nephrolepis biserrata", common: "Giant sword fern", status: "native" },
  { scientific: "Lygodium microphyllum", common: "Climbing fern", status: "native" },
  { scientific: "Mikania micrantha", common: "Mile-a-minute", status: "invasive" },
  { scientific: "Chromolaena odorata", common: "Siam weed", status: "invasive" },
  { scientific: "Acacia mangium", common: "Mangium", status: "introduced" },
  { scientific: "Hevea brasiliensis", common: "Rubber tree", status: "introduced" },
  { scientific: "Elaeis guineensis", common: "Oil palm", status: "introduced" },
  { scientific: "Musa spp.", common: "Banana", status: "native" },
  { scientific: "Bambusa vulgaris", common: "Common bamboo", status: "introduced" },
  { scientific: "Scirpus grossus", common: "Greater club-rush", status: "native" },
  { scientific: "Lepironia articulata", common: "Grey sedge", status: "native" },
  { scientific: "Pandanus amaryllifolius", common: "Pandan", status: "introduced" },
  { scientific: "Alpinia galanga", common: "Greater galangal", status: "native" },
  { scientific: "Cynodon dactylon", common: "Bermuda grass", status: "native" },
  { scientific: "Paspalum conjugatum", common: "Sourgrass", status: "introduced" },
];

export function speciesStatusFor(name: string | null | undefined): SpeciesStatus | null {
  if (!name) return null;
  const needle = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (!needle) return null;
  return (
    SPECIES_STATUS.find(
      (entry) =>
        entry.scientific.toLowerCase() === needle || entry.common.toLowerCase() === needle
    )?.status ?? null
  );
}

export const SPECIES_STATUS_LABELS: Record<SpeciesStatus, string> = {
  native: "Native",
  introduced: "Introduced",
  invasive: "Invasive",
};
