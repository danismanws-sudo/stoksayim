import { NextRequest, NextResponse } from "next/server";
import { buildOperationExcelBuffer, readDB, writeOperationExcelFile } from "@/lib/drive-store";
import { safePathPart } from "@/lib/utils";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ opId: string }> },
) {
  try {
    const { opId } = await context.params;
    const db = await readDB();
    const op = db.operations.find((o) => o.id === opId);
    if (!op) {
      return NextResponse.json({ error: "Operasyon bulunamadı" }, { status: 404 });
    }
    const host =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      "localhost:3000";
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.startsWith("127.") || host.startsWith("192.")
        ? "http"
        : "https");
    const baseUrl = `${proto}://${host}`;

    await writeOperationExcelFile(db, opId, baseUrl);
    const buf = await buildOperationExcelBuffer(db, opId, baseUrl);
    const fileName = `${safePathPart(op.code)}_Duran_Varlik_Sayim_Datasi.xlsx`;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error)?.message ?? "Excel oluşturulamadı" },
      { status: 500 },
    );
  }
}
