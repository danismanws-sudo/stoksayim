import fs from "node:fs/promises";
import { NextRequest, NextResponse } from "next/server";
import { resolvePhotoFilePath } from "@/lib/drive-store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await context.params;
    const photoPath = slug.join("/");
    const filePath = resolvePhotoFilePath(photoPath);
    const bytes = await fs.readFile(filePath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Fotoğraf bulunamadı", { status: 404 });
  }
}
