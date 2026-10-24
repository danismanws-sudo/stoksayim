import { NextRequest, NextResponse } from "next/server";
import { readItemPhotoBytes } from "@/lib/drive-store";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string[] }> },
) {
  try {
    const { slug } = await context.params;
    const photoPath = slug.join("/");
    const bytes = await readItemPhotoBytes(photoPath);
    if (!bytes) {
      return new NextResponse("Fotoğraf bulunamadı", { status: 404 });
    }
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
