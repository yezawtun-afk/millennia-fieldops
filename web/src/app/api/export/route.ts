import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/supabase/server";
import { queryRecords } from "@/lib/data";
import { buildRecordsCsv } from "@/lib/export/csv";
import { buildHazardPdf } from "@/lib/export/pdf";
import { PassThrough } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "supervisor" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Not authorised to export." }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const records = await queryRecords({
    q: sp.get("q") ?? undefined,
    type: sp.get("type") ?? undefined,
    status: sp.get("status") ?? undefined,
    completion: sp.get("completion") ?? undefined,
    severity: sp.get("severity") ?? undefined,
    zoneId: sp.get("zone") ?? undefined,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const format = sp.get("format") ?? "csv";

  if (format === "pdf") {
    const passthrough = new PassThrough();
    buildHazardPdf(records, passthrough);

    const chunks: Buffer[] = [];
    for await (const chunk of passthrough) chunks.push(chunk as Buffer);
    const pdf = Buffer.concat(chunks);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="hazard-summary-${stamp}.pdf"`,
      },
    });
  }

  const csv = buildRecordsCsv(records);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="field-records-${stamp}.csv"`,
    },
  });
}
