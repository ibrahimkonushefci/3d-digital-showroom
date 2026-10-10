import { proposalFinishes } from "./finishes";
import { jsPDF } from "jspdf";
import type {
  BrandConfig,
  Catalog,
  DesignDocument,
  Language,
} from "../catalog/types";
import type { InteriorDesign } from "../interior/types";
import type { FacadeDesign } from "../doorPreview/types";
import type { TranslationKey } from "../i18n";
import { money } from "../i18n";
import { calculatePrice } from "../pricing";
type T = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export async function imageToPng(url: string) {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(img.naturalWidth || 300, 600);
        canvas.height = (canvas.width * img.naturalHeight) / img.naturalWidth;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}
export async function createOffer({
  design,
  brand,
  catalog,
  language,
  screenshot,
  logoUrl,
  t,
  priceOverride,
  description,
  imageCaption,
}: {
  design: DesignDocument | FacadeDesign | InteriorDesign;
  brand: BrandConfig;
  catalog: Catalog;
  language: Language;
  screenshot: string | null;
  logoUrl: string;
  t: T;
  priceOverride?: ReturnType<typeof calculatePrice>;
  description?: string;
  imageCaption?: string;
}) {
  const pdf = new jsPDF();
  const bytes = new Uint8Array(
    await (await fetch("/shared/fonts/DejaVuSans.ttf")).arrayBuffer(),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  pdf.addFileToVFS("DejaVuSans.ttf", btoa(binary));
  pdf.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  pdf.setFont("DejaVu");
  const price =
    priceOverride ||
    calculatePrice(design as DesignDocument, catalog, language);
  const header = () => {
    pdf.setFillColor(brand.colors.primary);
    pdf.rect(0, 0, 210, 4, "F");
    pdf.setTextColor(brand.colors.text);
    pdf.setFontSize(12);
    pdf.text(pdf.splitTextToSize(brand.companyName, 154), 36, 17);
    pdf.setFontSize(7);
    pdf.text(
      pdf.splitTextToSize(
        [brand.contact.phone, brand.contact.email, brand.contact.city]
          .filter(Boolean)
          .join(" · "),
        154,
      ),
      36,
      29,
    );
  };
  const estimate = design.exact
    ? money(price.total, language)
    : `${money(price.low, language)} – ${money(price.high, language)}`;
  const project =
    description ||
    ("room" in design
      ? `${t(design.kind === "kitchen" ? "kitchens" : design.kind === "wardrobe" ? "wardrobes" : "interior")} · ${design.room.width} × ${design.room.depth} × ${design.room.height} cm`
      : t("doorsWindows"));
  header();
  try {
    pdf.addImage(await imageToPng(logoUrl), "PNG", 14, 11, 16, 16);
  } catch {
    /* Name is always present. */
  }
  pdf.setFontSize(23);
  pdf.text(t("proposal"), 14, 51);
  pdf.setFontSize(9);
  pdf.text(pdf.splitTextToSize(project, 182), 14, 63);
  pdf.setFillColor("#f2f0e9");
  pdf.rect(14, 80, 182, 108, "F");
  let imageAdded = false;
  if (screenshot)
    try {
      const props = pdf.getImageProperties(screenshot),
        factor = Math.min(182 / props.width, 108 / props.height);
      const w = props.width * factor,
        h = props.height * factor;
      pdf.addImage(
        screenshot,
        "PNG",
        14 + (182 - w) / 2,
        80 + (108 - h) / 2,
        w,
        h,
        undefined,
        "FAST",
      );
      imageAdded = true;
    } catch {
      /* A proposal remains useful without WebGL. */
    }
  if (!imageAdded) {
    pdf.setFontSize(10);
    pdf.text(pdf.splitTextToSize(t("imageUnavailable"), 150), 30, 130);
  }
  if (imageCaption) {
    pdf.setFontSize(7);
    pdf.text(pdf.splitTextToSize(imageCaption, 182).slice(0, 2), 14, 193);
  }
  pdf.setFontSize(10);
  pdf.text(t("finishes"), 14, 201);
  const finishes = proposalFinishes(design, catalog);
  for (const [i, m] of finishes.slice(0, 4).entries()) {
    const x = 14 + i * 46;
    pdf.setFillColor(m.color);
    pdf.roundedRect(x, 208, 40, 18, 1, 1, "F");
    const texture =
      design.kind === "interior" ? m.previewTexture || m.texture : m.texture;
    if (texture)
      try {
        const path = texture.startsWith("shared/")
          ? `/${texture}`
          : `/brands/${brand.catalogId || brand.slug}/${texture}`;
        pdf.addImage(await imageToPng(path), "PNG", x, 208, 40, 18);
      } catch {
        /* Color swatch fallback. */
      }
    pdf.setFontSize(7);
    pdf.text(pdf.splitTextToSize(m.name[language], 40).slice(0, 3), x, 231);
  }
  pdf.setFontSize(6.5);
  pdf.setTextColor("#6d746b");
  pdf.text(t("illustrativeFinish"), 14, 247);
  pdf.setFillColor(brand.colors.primary);
  pdf.roundedRect(14, 256, 182, 24, 2, 2, "F");
  pdf.setTextColor("#ffffff");
  pdf.setFontSize(8);
  pdf.text(t("estimate"), 20, 265);
  pdf.setFontSize(16);
  pdf.text(estimate, 190, 274, { align: "right" });
  pdf.addPage();
  header();
  let y = 45;
  const ensureSpace = (height: number) => {
    if (y + height > 269) {
      pdf.addPage();
      header();
      y = 45;
    }
  };
  const paragraph = (text: string) => {
    pdf.setFontSize(9);
    for (const line of pdf.splitTextToSize(text, 182)) {
      ensureSpace(5);
      pdf.text(line, 14, y);
      y += 4.5;
    }
    y += 3;
  };
  pdf.setFontSize(14);
  pdf.text(t("projectDetails"), 14, y);
  y += 10;
  paragraph(project);
  if (design.offer) {
    const o = design.offer;
    for (const text of [
      `${t("offerNumber")}: ${o.number} · ${t("offerDate")}: ${o.date}`,
      t("validFor", { days: o.validityDays }),
      `${t("customer")}: ${[o.customer.name, o.customer.phone, o.customer.city].filter(Boolean).join(" · ")}`,
      `${t("salesperson")}: ${o.salesperson}`,
      `${t("paymentTerms")}: ${o.paymentTerms}`,
      ...(o.notes ? [`${t("notes")}: ${o.notes}`] : []),
    ])
      paragraph(text);
  }
  if (design.kind === "kitchen" || design.kind === "wardrobe") {
    const dimensions = [
      ...new Set(
        design.cabinets.map(
          (c) =>
            `${catalog.modules.find((m) => m.id === c.moduleId)?.name[language] || c.moduleId}: ${c.width} × ${c.depth} × ${c.height} cm`,
        ),
      ),
    ];
    paragraph(dimensions.join(" · "));
  } else if (design.kind === "facade")
    paragraph(
      design.items
        .map(
          (p) =>
            `${(p.kind === "door" ? catalog.doors : catalog.windows).find((m) => m.id === p.modelId)?.name[language] || p.modelId}: ${p.width} × ${p.height} cm`,
        )
        .join(" · "),
    );
  else if ("doors" in design)
    paragraph(
      design.doors
        .map(
          (d) =>
            `${catalog.interiorDoors.find((m) => m.id === d.modelId)?.name[language] || d.modelId}: ${d.width} × ${d.height} cm · ${t("frameHeight")} ${d.frameHeight} cm · ${t("frameDepth")} ${d.frameDepth} cm`,
        )
        .join(" · "),
    );
  if (finishes.length > 4)
    paragraph(
      `${t("finishes")}: ${finishes.map((m) => m.name[language]).join(" · ")}`,
    );
  ensureSpace(24);
  pdf.setFontSize(13);
  pdf.text(t("parts"), 14, y);
  y += 10;
  const tableHeader = () => {
    pdf.setFillColor("#efeee8");
    pdf.rect(14, y - 5, 182, 9, "F");
    pdf.setFontSize(8);
    pdf.text(t("item"), 17, y);
    pdf.text(t("quantity"), 145, y, { align: "right" });
    pdf.text(t("amount"), 193, y, { align: "right" });
    y += 10;
  };
  tableHeader();
  const row = (name: string, quantity: string, amount: number) => {
    pdf.setFontSize(8.5);
    const lines = pdf.splitTextToSize(name, 110);
    const height = Math.max(8, lines.length * 4 + 4);
    if (y + height > 268) {
      pdf.addPage();
      header();
      y = 45;
      tableHeader();
    }
    pdf.text(lines, 17, y);
    pdf.text(quantity, 145, y, { align: "right" });
    pdf.text(money(amount, language), 193, y, { align: "right" });
    y += height;
    pdf.setDrawColor("#e1e3db");
    pdf.line(14, y - 4, 196, y - 4);
  };
  for (const line of price.lines)
    row(
      line.id === "led" || line.id === "plinth" ? t(line.id) : line.name,
      `${new Intl.NumberFormat(language === "en" ? "en-IE" : "de-DE", { maximumFractionDigits: 2 }).format(line.quantity)}${line.unit === "m" ? " m" : line.unit === "m2" ? " m²" : ""}`,
      line.amount,
    );
  if (design.installation) {
    if (design.kind === "interior") {
      row(
        t("floorInstallation"),
        "",
        ((design.room.width * design.room.depth) / 10000) *
          catalog.interiorPricing!.floorInstallationPerM2,
      );
      row(
        t("doorInstallation"),
        "",
        design.doors.length * catalog.interiorPricing!.doorInstallationPerPiece,
      );
    } else
      row(
        design.kind === "facade"
          ? t("installation")
          : `${t("installation")} (${catalog.pricing.installationPercent}%)`,
        "",
        price.installation,
      );
  }
  if (design.vat)
    row(`${t("vat")} (${catalog.pricing.vatPercent}%)`, "", price.vat);
  ensureSpace(35);
  y += 5;
  pdf.setFontSize(12);
  pdf.text(t("estimate"), 14, y);
  pdf.text(estimate, 196, y, { align: "right" });
  y += 12;
  paragraph(t("priceDisclaimer"));
  for (let page = 1; page <= pdf.getNumberOfPages(); page++) {
    pdf.setPage(page);
    pdf.setFontSize(7);
    pdf.setTextColor("#758074");
    if (brand.demo) pdf.text(t("demoNotice"), 14, 289);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, 196, 289, {
      align: "right",
    });
  }
  return pdf;
}
