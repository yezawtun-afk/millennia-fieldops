// PDF hazard summary: a short report of the active (not rejected) trail hazards.
import PDFDocument from "pdfkit";
import type { FieldRecord } from "../types";
import { SEVERITY_LABELS } from "../format";
import { toDateOnly } from "./format-date";

const SEVERITY_ORDER = ["critical", "medium", "low"] as const;

export function buildHazardPdf(records: FieldRecord[], stream: NodeJS.WritableStream) {
  const hazards = records
    .filter((r) => r.type === "hazard" && r.status !== "rejected")
    .sort((a, b) => {
      const ai = a.severity ? SEVERITY_ORDER.indexOf(a.severity) : 99;
      const bi = b.severity ? SEVERITY_ORDER.indexOf(b.severity) : 99;
      return ai - bi;
    });

  const doc = new PDFDocument({ size: "A4", layout: "portrait", margin: 40 });
  doc.pipe(stream);

  doc.fontSize(18).fillColor("#0F2E22").text("Millennia FieldOps - Active Trail Hazards");
  doc.moveDown(0.2);
  doc
    .fontSize(9)
    .fillColor("#555555")
    .text(`Generated ${new Date().toLocaleString()} - ${hazards.length} active hazard(s)`);
  doc.moveDown(0.8);

  // Summary counts by severity.
  const counts = { critical: 0, medium: 0, low: 0 } as Record<string, number>;
  for (const h of hazards) if (h.severity) counts[h.severity] += 1;

  doc.fontSize(11).fillColor("#0F2E22").text("Summary by severity");
  doc.moveDown(0.3);
  for (const key of SEVERITY_ORDER) {
    doc.fontSize(10).fillColor("#222222").text(`${SEVERITY_LABELS[key]}: ${counts[key]}`);
  }
  doc.moveDown(1);

  if (hazards.length === 0) {
    doc.fontSize(10).fillColor("#555555").text("No active hazards were found.");
    doc.end();
    return;
  }

  for (const h of hazards) {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 90) doc.addPage();

    const severity = h.severity ? SEVERITY_LABELS[h.severity] : "Unrated";
    doc.fontSize(12).fillColor("#0F2E22").text(h.title, { continued: false });
    doc
      .fontSize(9)
      .fillColor("#555555")
      .text(
        `${severity} - ${h.hazard_type || "Hazard"} - ${h.zone?.name || "No zone"} - ` +
          `observed ${toDateOnly(h.observed_date)} - status ${h.status}`
      );
    if (h.latitude != null && h.longitude != null) {
      doc.fontSize(8).fillColor("#777777").text(`Coordinates: ${h.latitude}, ${h.longitude}`);
    }
    if (h.notes) {
      doc.moveDown(0.2);
      doc.fontSize(9).fillColor("#222222").text(h.notes, { lineGap: 1 });
    }
    doc.moveDown(0.8);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor("#DDDDDD").stroke();
    doc.moveDown(0.8);
  }

  doc.end();
}
