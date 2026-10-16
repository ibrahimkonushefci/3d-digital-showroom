/** Ready-made looks: one tap sets fronts, worktop, handles, plinth, carcass
 * and floor together, using finishes from the existing palette. */
export interface CuratedTheme {
  id: string;
  name: { en: string; sq: string; de: string };
  desc: { en: string; sq: string; de: string };
  front: string;
  countertop: string;
  carcass: string;
  handle: string;
  plinth: string;
  led: boolean;
  profile: "flat" | "panel";
  floor: "laminate" | "tiles" | "concrete";
  swatches: string[];
}

export const KITCHEN_THEMES: CuratedTheme[] = [
  {
    id: "japandi",
    name: {
      en: "Japandi Minimal",
      sq: "Japandi Minimal",
      de: "Japandi Minimal",
    },
    desc: {
      en: "Cashmere matte & Travertine stone",
      sq: "Kashmir mat & gur Travertin",
      de: "Kaschmir matt & Travertinstein",
    },
    front: "cashmere",
    countertop: "travertine",
    carcass: "oak",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#d7ccba", "#c8bca8", "#bb8a55", "#202227"],
  },
  {
    id: "anthracite",
    name: {
      en: "Modern Anthracite",
      sq: "Antracit Modern",
      de: "Modernes Anthrazit",
    },
    desc: {
      en: "Deep charcoal & Granite stone",
      sq: "Antracit i errët & Granit",
      de: "Tiefes Anthrazit & Granit",
    },
    front: "anthracite",
    countertop: "granite",
    carcass: "dark",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "concrete",
    swatches: ["#343e3e", "#232927", "#1a1c20", "#202227"],
  },
  {
    id: "sage",
    name: {
      en: "Nordic Sage",
      sq: "Sherebele Nordike",
      de: "Nordisches Salbei",
    },
    desc: {
      en: "Sage green & Carrara marble",
      sq: "Gjelbër sherebele & Mermer Carrara",
      de: "Salbeigrün & Carrara-Marmor",
    },
    front: "sage",
    countertop: "marble",
    carcass: "white",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#7e927a", "#dedad3", "#1a1c20", "#202227"],
  },
  {
    id: "white-brass",
    name: {
      en: "Warm White & Oak",
      sq: "E bardhë e ngrohtë & Lis",
      de: "Warmweiß & Eiche",
    },
    desc: {
      en: "Warm white & Natural oak countertop",
      sq: "E bardhë e ngrohtë & Banak lisi",
      de: "Warmweiß & Eichenplatte",
    },
    front: "white",
    countertop: "oak",
    carcass: "oak",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#f3f0e6", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "oak",
    name: { en: "Natural Oak", sq: "Lis Natyral", de: "Eichendekor" },
    desc: {
      en: "Oak decor & Travertine",
      sq: "Lis natyral & Gur Travertin",
      de: "Natureiche & Travertin",
    },
    front: "oak",
    countertop: "travertine",
    carcass: "dark",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#bb8a55", "#c8bca8", "#232927", "#202227"],
  },
];

export const WARDROBE_THEMES: CuratedTheme[] = [
  {
    id: "milano-oak",
    name: {
      en: "Milano Oak",
      sq: "Lis Milano",
      de: "Milano Eiche",
    },
    desc: {
      en: "Oak decor & stainless handles",
      sq: "Dekor lisi & doreza inox",
      de: "Eichendekor & Edelstahlgriffe",
    },
    front: "oak",
    countertop: "travertine",
    carcass: "dark",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#bb8a55", "#343e3e", "#1a1c20", "#202227"],
  },
  {
    id: "nordic-cashmere",
    name: {
      en: "Nordic Cashmere",
      sq: "Kashmir Nordik",
      de: "Nordisches Kaschmir",
    },
    desc: {
      en: "Cashmere matte & warm oak carcass",
      sq: "Kashmir mat & korpus lisi të ngrohtë",
      de: "Kaschmir matt & warmer Eichenkorpus",
    },
    front: "cashmere",
    countertop: "travertine",
    carcass: "oak",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#d7ccba", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "metropolitan-anthracite",
    name: {
      en: "Metropolitan Anthracite",
      sq: "Antracit Metropol",
      de: "Metropolitan Anthrazit",
    },
    desc: {
      en: "Deep matte anthracite & black profiles",
      sq: "Antracit mat & profile të zeza",
      de: "Mattes Anthrazit & schwarze Profile",
    },
    front: "anthracite",
    countertop: "granite",
    carcass: "dark",
    handle: "profile",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "concrete",
    swatches: ["#343e3e", "#232927", "#1a1c20", "#202227"],
  },
  {
    id: "modern-white",
    name: {
      en: "Modern White & Oak",
      sq: "E Bardhë & Lis",
      de: "Modernes Weiß & Eiche",
    },
    desc: {
      en: "Warm white & natural oak interior",
      sq: "E bardhë e ngrohtë & brendësi lisi",
      de: "Warmweiß & Eichen-Innenleben",
    },
    front: "white",
    countertop: "travertine",
    carcass: "oak",
    handle: "bar",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#f3f0e6", "#bb8a55", "#1a1c20", "#202227"],
  },
  {
    id: "boutique-walnut",
    name: { en: "Boutique Walnut", sq: "Arrë Luksoze", de: "Boutique Walnuss" },
    desc: {
      en: "Rich walnut fronts & dark interior",
      sq: "Arrë e pasur & brendësi e errët",
      de: "Edles Walnuss & dunkler Korpus",
    },
    front: "walnut",
    countertop: "travertine",
    carcass: "dark",
    handle: "none",
    plinth: "black",
    led: true,
    profile: "flat",
    floor: "laminate",
    swatches: ["#74533a", "#232927", "#1a1c20", "#202227"],
  },
];
