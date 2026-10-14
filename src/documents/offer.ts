import { interiorAssociations } from "./finishes";
import {
  proposalFinishes,
  finishAssociations,
  hasFinishOverrides,
} from "./finishes";
import { jsPDF } from "jspdf";
import type {
  BrandConfig,
  Catalog,
  DesignDocument,
  Language,
} from "../catalog/types";
import type { TranslationKey } from "../i18n";
import { money, number } from "../i18n";
import { calculatePrice, estimateLabel, quantityLabel } from "../pricing";
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
/** Redraws an image on a canvas so the document embeds a compact copy. */
function imageData(url: string, maxWidth: number, type: "png" | "jpeg") {
  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(img.naturalWidth || maxWidth, maxWidth);
        canvas.height = Math.round(
          (canvas.width * img.naturalHeight) / img.naturalWidth,
        );
        const ctx = canvas.getContext("2d")!;
        if (type === "jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(`image/${type}`, 0.85));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = reject;
    img.src = url;
  });
}
export const imageToPng = (url: string) => imageData(url, 600, "png");
async function fontData(url: string) {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
/** dd.mm.yyyy, as documents are dated in Kosovo and Germany. */
export function documentDate(iso: string, addDays = 0) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + addDays));
  return [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]
    .map((n) => String(n).padStart(2, "0"))
    .join(".");
}
export function offerFileName(brand: BrandConfig, design: DesignDocument) {
  return `${brand.slug}-${design.offer?.number || design.kind + "-offer"}.pdf`;
}
const LEFT = 14,
  RIGHT = 196,
  WIDTH = RIGHT - LEFT,
  CONTENT_BOTTOM = 270,
  MUTED = "#6b7268",
  RULE = "#e1e3db",
  PANEL = "#f4f2ec",
  // Matches the 3D scene background so the render sits flush in its frame.
  SCENE = "#eee9df";
export async function createOffer({
  design,
  brand,
  catalog,
  language,
  screenshot,
  logoUrl,
  t,
  presentation = false,
}: {
  design: DesignDocument;
  brand: BrandConfig;
  catalog: Catalog;
  language: Language;
  screenshot: string | null;
  logoUrl: string;
  t: T;
  /** Presentation mode hides the fictional-demo notice. */
  presentation?: boolean;
}) {
  const pdf = new jsPDF();
  const [regular, bold] = await Promise.all([
    fontData("/shared/fonts/DejaVuSans.ttf"),
    fontData("/shared/fonts/DejaVuSans-Bold.ttf"),
  ]);
  pdf.addFileToVFS("DejaVuSans.ttf", regular);
  pdf.addFont("DejaVuSans.ttf", "DejaVu", "normal");
  pdf.addFileToVFS("DejaVuSans-Bold.ttf", bold);
  pdf.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
  const ink = brand.colors.text;
  const font = (
    size: number,
    weight: "normal" | "bold" = "normal",
    color = ink,
  ) => {
    pdf.setFont("DejaVu", weight);
    pdf.setFontSize(size);
    pdf.setTextColor(color);
  };
  const price = calculatePrice(design, catalog, language),
    offer = design.offer,
    pricing = catalog.pricing;
  const logo = await imageToPng(logoUrl).catch(() => null);
  const contactLine = [
    [brand.contact.address, brand.contact.city].filter(Boolean).join(", "),
    brand.contact.phone,
    brand.contact.email,
    brand.legal.website,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const header = () => {
    pdf.setFillColor(brand.colors.primary);
    pdf.rect(0, 0, 210, 3, "F");
    let x = LEFT;
    if (logo)
      try {
        pdf.addImage(logo, "PNG", LEFT, 9, 14, 14, "logo");
        x = LEFT + 18;
      } catch {
        /* The company name stands on its own. */
      }
    font(13, "bold");
    pdf.text(pdf.splitTextToSize(brand.companyName, 110)[0], x, 15);
    font(7.5, "normal", MUTED);
    pdf.text(pdf.splitTextToSize(contactLine, 118).slice(0, 2), x, 20.5);
    font(15, "bold", brand.colors.primary);
    pdf.text(t("offerTitle"), RIGHT, 15, { align: "right" });
    if (offer) {
      font(8, "normal", MUTED);
      pdf.text(`${t("offerNumber")}: ${offer.number}`, RIGHT, 20.5, {
        align: "right",
      });
    }
    pdf.setDrawColor(RULE);
    pdf.line(LEFT, 28, RIGHT, 28);
  };

  // Page 1: who it is for, what it looks like, and what it costs.
  header();
  const customer = offer
    ? [offer.customer.name, offer.customer.phone, offer.customer.city].filter(
        Boolean,
      )
    : [];
  pdf.setFillColor(PANEL);
  pdf.roundedRect(LEFT, 34, WIDTH, 25, 2, 2, "F");
  const cell = (x: number, y: number, title: string, value: string) => {
    font(6.8, "normal", MUTED);
    pdf.text(title, x, y);
    font(9);
    pdf.text(pdf.splitTextToSize(value || "—", 82)[0], x, y + 4.6);
  };
  cell(LEFT + 5, 40, t("offerFor"), customer.join(" · "));
  cell(LEFT + 5, 50.5, t("salesperson"), offer?.salesperson || "");
  cell(LEFT + 100, 40, t("offerDate"), offer ? documentDate(offer.date) : "");
  cell(
    LEFT + 100,
    50.5,
    t("validUntil"),
    offer ? documentDate(offer.date, offer.validityDays) : "",
  );
  const project = `${t(design.kind === "kitchen" ? "kitchens" : "wardrobes")} · ${t(design.layout)} · ${design.room.width} × ${design.room.depth} × ${design.room.height} cm`;
  font(11, "bold");
  pdf.text(pdf.splitTextToSize(project, WIDTH)[0], LEFT, 68);
  pdf.setFillColor(SCENE);
  pdf.rect(LEFT, 72, WIDTH, 102, "F");
  let imageAdded = false;
  if (screenshot)
    try {
      const jpeg = await imageData(screenshot, 1600, "jpeg").catch(
        () => screenshot,
      );
      const props = pdf.getImageProperties(jpeg),
        factor = Math.min(WIDTH / props.width, 102 / props.height);
      const w = props.width * factor,
        h = props.height * factor;
      pdf.addImage(
        jpeg,
        jpeg.startsWith("data:image/png") ? "PNG" : "JPEG",
        LEFT + (WIDTH - w) / 2,
        72 + (102 - h) / 2,
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
    font(9, "normal", MUTED);
    pdf.text(pdf.splitTextToSize(t("imageUnavailable"), 150), 30, 122);
  }
  font(9, "bold");
  pdf.text(t("finishes"), LEFT, 182);
  const finishes = proposalFinishes(design, catalog);
  for (const [i, m] of finishes.slice(0, 4).entries()) {
    const x = LEFT + i * 46;
    pdf.setFillColor(m.color);
    pdf.roundedRect(x, 185, 42, 13, 1, 1, "F");
    if (m.texture)
      try {
        const path = m.texture.startsWith("shared/")
          ? `/${m.texture}`
          : `/brands/${brand.catalogId || brand.slug}/${m.texture}`;
        pdf.addImage(
          await imageData(path, 240, "jpeg"),
          "JPEG",
          x,
          185,
          42,
          13,
        );
      } catch {
        /* Colour swatch fallback. */
      }
    font(7);
    pdf.text(pdf.splitTextToSize(m.name[language], 42).slice(0, 2), x, 202.5);
  }
  font(6.5, "normal", MUTED);
  pdf.text(t("illustrativeFinish"), LEFT, 212);
  const totalTitle = design.exact
    ? t(design.vat ? "totalInclVat" : "totalExclVat")
    : t("estimate");
  pdf.setFillColor(brand.colors.primary);
  pdf.roundedRect(LEFT, 218, WIDTH, 24, 2, 2, "F");
  font(9, "bold", "#ffffff");
  pdf.text(totalTitle, LEFT + 6, 228);
  font(7, "normal", "#ffffff");
  pdf.text(
    [
      design.installation && t("installationIncluded"),
      !design.exact && design.vat && t("totalInclVat"),
    ]
      .filter(Boolean)
      .join(" · "),
    LEFT + 6,
    234,
  );
  font(17, "bold", "#ffffff");
  pdf.text(estimateLabel(price, design.exact, language), RIGHT - 6, 233, {
    align: "right",
  });
  font(7.5, "normal", MUTED);
  pdf.text(pdf.splitTextToSize(t("priceDisclaimer"), WIDTH), LEFT, 250);
  if (offer) {
    font(8);
    pdf.text(
      pdf.splitTextToSize(
        [
          offer.paymentTerms && `${t("paymentTerms")}: ${offer.paymentTerms}`,
          t("validFor", { days: offer.validityDays }),
        ]
          .filter(Boolean)
          .join("  ·  "),
        WIDTH,
      ),
      LEFT,
      260,
    );
  }

  // Page 2+: every position, the totals, terms and signatures.
  pdf.addPage();
  header();
  let y = 40;
  const ensureSpace = (height: number) => {
    if (y + height <= CONTENT_BOTTOM) return false;
    pdf.addPage();
    header();
    y = 40;
    return true;
  };
  if (hasFinishOverrides(design)) {
    font(13, "bold");
    pdf.text(t("finishAssociations"), LEFT, y);
    y += 9;
    for (const row of finishAssociations(design, catalog, language)) {
      font(8, "bold");
      const title = pdf.splitTextToSize(
        `${row.scope} · ${row.quantity}`,
        WIDTH,
      );
      font(8);
      const detail = pdf.splitTextToSize(row.description, WIDTH);
      ensureSpace((title.length + detail.length) * 4 + 5);
      font(8, "bold");
      pdf.text(title, LEFT, y);
      y += title.length * 4;
      font(8);
      pdf.text(detail, LEFT, y);
      y += detail.length * 4 + 5;
    }
    ensureSpace(24);
  }
  if (design.cabinets.some((c) => c.interior)) {
    ensureSpace(20);
    font(13, "bold");
    pdf.text(t("interiorInventory"), LEFT, y);
    y += 9;
    font(8);
    const note = pdf.splitTextToSize(t("interiorInventoryNote"), WIDTH);
    ensureSpace(note.length * 4 + 6);
    pdf.text(note, LEFT, y);
    y += note.length * 4 + 6;
    for (const row of interiorAssociations(design, catalog, language)) {
      const title = pdf.splitTextToSize(row.scope, WIDTH),
        detail = pdf.splitTextToSize(row.description, WIDTH);
      ensureSpace((title.length + detail.length) * 4 + 6);
      font(8, "bold");
      pdf.text(title, LEFT, y);
      y += title.length * 4;
      font(8);
      pdf.text(detail, LEFT, y);
      y += detail.length * 4 + 6;
    }
    ensureSpace(24);
  }
  font(13, "bold");
  pdf.text(t("parts"), LEFT, y);
  y += 9;
  const columns = {
    pos: LEFT + 2,
    item: LEFT + 11,
    size: 100,
    quantity: 141,
    unit: 169,
    amount: RIGHT - 2,
  };
  const tableHeader = () => {
    pdf.setFillColor("#efeee8");
    pdf.rect(LEFT, y - 5, WIDTH, 8, "F");
    font(7.3, "bold");
    pdf.text(t("pos"), columns.pos, y);
    pdf.text(t("item"), columns.item, y);
    pdf.text(t("dimensions"), columns.size, y);
    pdf.text(t("quantity"), columns.quantity, y, { align: "right" });
    pdf.text(t("unitPrice"), columns.unit, y, { align: "right" });
    pdf.text(t("amount"), columns.amount, y, { align: "right" });
    y += 9;
  };
  tableHeader();
  price.lines.forEach((line, i) => {
    font(8.3);
    const lines = pdf.splitTextToSize(
      line.name,
      columns.size - columns.item - 3,
    );
    const height = Math.max(7, lines.length * 3.8 + 3.2);
    if (ensureSpace(height)) tableHeader();
    font(8.3, "normal", MUTED);
    pdf.text(String(i + 1), columns.pos, y);
    font(8.3);
    pdf.text(lines, columns.item, y);
    if (line.size) pdf.text(line.size.join(" × "), columns.size, y);
    pdf.text(quantityLabel(line, language, t("pieces")), columns.quantity, y, {
      align: "right",
    });
    pdf.text(money(line.unitPrice, language), columns.unit, y, {
      align: "right",
    });
    pdf.text(money(line.amount, language), columns.amount, y, {
      align: "right",
    });
    y += height;
    pdf.setDrawColor(RULE);
    pdf.line(LEFT, y - 4.5, RIGHT, y - 4.5);
  });

  const totals: Array<[string, string, boolean?]> = [
    [t("subtotal"), money(price.subtotal, language)],
    ...(price.discount > 0
      ? [
          [
            `${t("discount")} (${number(price.discountPercent, language)}%)`,
            `− ${money(price.discount, language)}`,
          ] as [string, string],
        ]
      : []),
    ...(design.installation
      ? [
          [
            `${t("installation")} (${pricing.installationPercent}%)`,
            money(price.installation, language),
          ] as [string, string],
        ]
      : []),
    ...(design.vat
      ? [
          [t("totalExclVat"), money(price.net, language)] as [string, string],
          [
            `${t("vat")} (${pricing.vatPercent}%)`,
            money(price.vat, language),
          ] as [string, string],
        ]
      : []),
    [
      t(design.vat ? "totalInclVat" : "totalExclVat"),
      money(price.total, language),
      true,
    ],
  ];
  ensureSpace(totals.length * 6.5 + 14);
  y += 2;
  for (const [title, value, strong] of totals) {
    if (strong) {
      pdf.setDrawColor(ink);
      pdf.line(112, y - 4.2, RIGHT, y - 4.2);
      y += 1.5;
    }
    font(strong ? 11 : 8.5, strong ? "bold" : "normal");
    pdf.text(title, 114, y);
    pdf.text(value, RIGHT - 2, y, { align: "right" });
    y += strong ? 8 : 6.5;
  }
  if (!design.exact) {
    font(7.5, "normal", MUTED);
    pdf.text(
      `${t("estimateRange", { percent: pricing.rangePercent })}: ${estimateLabel(price, false, language)}`,
      RIGHT - 2,
      y,
      { align: "right" },
    );
    y += 7;
  }
  y += 4;
  const paragraph = (title: string, text: string) => {
    if (!text) return;
    ensureSpace(14);
    font(8.5, "bold");
    pdf.text(title, LEFT, y);
    y += 5;
    font(8.3);
    for (const row of pdf.splitTextToSize(text, WIDTH)) {
      ensureSpace(5);
      pdf.text(row, LEFT, y);
      y += 4.3;
    }
    y += 3;
  };
  if (offer) {
    paragraph(t("notes"), offer.notes);
    paragraph(
      t("paymentTerms"),
      [offer.paymentTerms, t("validFor", { days: offer.validityDays })]
        .filter(Boolean)
        .join(" · "),
    );
  }
  font(7.5, "normal", MUTED);
  for (const row of pdf.splitTextToSize(t("priceDisclaimer"), WIDTH)) {
    ensureSpace(5);
    pdf.text(row, LEFT, y);
    y += 4;
  }

  // Signatures: the document a client can accept on the spot.
  y += 6;
  ensureSpace(36);
  const boxWidth = (WIDTH - 12) / 3;
  const boxes: Array<[string, string]> = [
    [t("forCompany"), offer?.salesperson || brand.companyName],
    [t("stamp"), ""],
    [t("customerAcceptance"), t("nameDateSignature")],
  ];
  boxes.forEach(([title, caption], i) => {
    const x = LEFT + i * (boxWidth + 6);
    pdf.setDrawColor(RULE);
    pdf.roundedRect(x, y, boxWidth, 30, 1.5, 1.5, "S");
    font(8, "bold");
    pdf.text(title, x + 4, y + 6);
    if (caption) {
      pdf.setDrawColor(MUTED);
      pdf.line(x + 4, y + 22, x + boxWidth - 4, y + 22);
      font(6.8, "normal", MUTED);
      pdf.text(pdf.splitTextToSize(caption, boxWidth - 8)[0], x + 4, y + 26);
    }
  });

  // Footer: registration and payment details on every page.
  const legal = [
    brand.legal.businessNumber &&
      `${t("businessNumber")} ${brand.legal.businessNumber}`,
    brand.legal.fiscalNumber &&
      `${t("fiscalNumber")} ${brand.legal.fiscalNumber}`,
    brand.legal.vatNumber && `${t("vatNumber")} ${brand.legal.vatNumber}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const bank = [
    brand.legal.bankName,
    brand.legal.iban && `${t("iban")} ${brand.legal.iban}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(RULE);
    pdf.line(LEFT, 278, RIGHT, 278);
    font(6.8, "normal", MUTED);
    if (legal) pdf.text(legal, LEFT, 283);
    if (bank) pdf.text(bank, LEFT, 287);
    pdf.text(`${page} / ${pages}`, RIGHT, 287, { align: "right" });
    if (brand.demo && !presentation) pdf.text(t("demoNotice"), LEFT, 292);
  }
  return pdf;
}
