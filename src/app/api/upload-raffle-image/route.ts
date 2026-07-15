import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadRaffleImage } from "@/lib/upload";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { ok: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { ok: false, error: "Selecciona una imagen." },
        { status: 400 },
      );
    }

    const uploaded = await uploadRaffleImage(file);
    return NextResponse.json({ ok: true, url: uploaded.url });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "No se pudo subir la imagen.",
      },
      { status: 500 },
    );
  }
}
