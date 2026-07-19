import { del, put } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const PROOF_EXT = new Set([...IMAGE_EXT, "pdf"]);

function guessMime(file: File) {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  if (ext === "heic") return "image/heic";
  if (ext === "heif") return "image/heif";
  return "application/octet-stream";
}

async function storeFile(
  file: File,
  folder: "proofs" | "raffles",
  allowed: Set<string>,
  imagesOnly: boolean,
) {
  const mime = guessMime(file);
  const ext = (
    file.name.split(".").pop()?.toLowerCase() ||
    (mime.includes("pdf") ? "pdf" : "jpg")
  ).replace(/[^a-z0-9]/g, "");

  if (imagesOnly) {
    if (!IMAGE_EXT.has(ext) && !mime.startsWith("image/")) {
      throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
    }
  } else if (
    !allowed.has(ext) &&
    !mime.startsWith("image/") &&
    mime !== "application/pdf"
  ) {
    throw new Error("Formato no permitido. Usa JPG, PNG, WEBP o PDF.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("El archivo supera 8MB.");
  }
  if (file.size === 0) {
    throw new Error("El archivo está vacío.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${folder}/${nanoid()}.${ext || "bin"}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(filename, buffer, {
      access: "public",
      contentType: mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      url: blob.url,
      fileName: file.name,
      mimeType: mime,
    };
  }

  // En Vercel (servidor sin disco público) hace falta Blob Storage.
  if (process.env.VERCEL) {
    throw new Error(
      "Falta configurar el almacenamiento de imágenes. En Vercel: Storage → Blob → conectar al proyecto (BLOB_READ_WRITE_TOKEN).",
    );
  }

  try {
    const dir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(dir, { recursive: true });
    const localName = `${nanoid()}.${ext || "bin"}`;
    await writeFile(path.join(dir, localName), buffer);
    return {
      url: `/uploads/${folder}/${localName}`,
      fileName: file.name,
      mimeType: mime,
    };
  } catch {
    throw new Error(
      "No se pudo guardar la imagen en disco. Configura BLOB_READ_WRITE_TOKEN o revisa permisos de public/uploads.",
    );
  }
}

export async function uploadProofFile(file: File) {
  return storeFile(file, "proofs", PROOF_EXT, false);
}

export async function uploadRaffleImage(file: File) {
  return storeFile(file, "raffles", IMAGE_EXT, true);
}

function isVercelBlobUrl(url: string) {
  try {
    const host = new URL(url).hostname;
    return (
      host.endsWith(".blob.vercel-storage.com") ||
      host === "blob.vercel-storage.com"
    );
  } catch {
    return false;
  }
}

/** Borra archivos propios (Blob o /uploads). Ignora URLs externas y fallos puntuales. */
export async function deleteStoredFiles(
  urls: Array<string | null | undefined>,
) {
  const unique = [
    ...new Set(
      urls
        .filter((url): url is string => Boolean(url && url.trim()))
        .map((url) => url.trim()),
    ),
  ];
  if (unique.length === 0) return;

  const blobUrls = unique.filter(isVercelBlobUrl);
  if (blobUrls.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      await del(blobUrls, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (err) {
      console.error("[blob] delete failed", err);
    }
  }

  for (const url of unique) {
    if (!url.startsWith("/uploads/")) continue;
    try {
      await unlink(path.join(process.cwd(), "public", url));
    } catch {
      /* archivo ya ausente o sin permiso local */
    }
  }
}
