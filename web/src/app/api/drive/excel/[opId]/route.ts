import { NextRequest, NextResponse } from "next/server";
import { buildOperationExcelBuffer, readDB, writeOperationExcelFile } from "@/lib/drive-store";
import { safePathPart } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ opId: string }> },
) {
  try {
    const { opId } = await context.params;
    const db = await readDB();
    const op = db.operations.find((o) => o.id === opId);
    if (!op) {
      return NextResponse.json({ error: "Operasyon bulunamadı" }, { status: 404 });
    }
    await writeOperationExcelFile(db, opId);
    const buf = await buildOperationExcelBuffer(db, opId);
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
