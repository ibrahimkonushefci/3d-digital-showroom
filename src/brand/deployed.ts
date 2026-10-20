/** Brand folders shipped in public/brands. Settings lists them; a brand
 * export never reuses their folder names, so unzipping it cannot replace one. */
export const deployedBrands = [
  { slug: "default", name: "Forma Studio" },
  { slug: "druri-design", name: "Druri Design" },
] as const;
/** The folder is taken by a shipped brand or by the brand this page loaded. */
export function brandFolderTaken(slug: string, loadedFolder: string) {
  return (
    slug === loadedFolder || deployedBrands.some((brand) => brand.slug === slug)
  );
}
