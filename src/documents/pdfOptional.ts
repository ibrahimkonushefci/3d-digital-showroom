/** jsPDF loads html2canvas, DOMPurify and canvg only for HTML and SVG
 * input, which the offer PDF never uses; the build aliases them here so
 * they are neither shipped nor precached (about 390 KB). */
export default function unavailable(): never {
  throw Error("Not included in this build");
}
export const Canvg = unavailable;
