/**
 * Almacenamiento de archivos generados por la Plataforma en DigitalOcean Spaces (API compatible con S3).
 * Variables: SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function env(n: string) { return (process.env[n] || "").trim(); }

export function storageConfigured(): boolean {
  return Boolean(env("SPACES_ENDPOINT") && env("SPACES_BUCKET") && env("SPACES_KEY") && env("SPACES_SECRET"));
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env("SPACES_ENDPOINT"),
      region: env("SPACES_REGION") || "us-east-1",
      forcePathStyle: false,
      credentials: { accessKeyId: env("SPACES_KEY"), secretAccessKey: env("SPACES_SECRET") }
    });
  }
  return client;
}

export function slugify(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase().slice(0, 60) || "archivo";
}

/** Sube un archivo privado y devuelve su clave. */
export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
  if (!storageConfigured()) throw new Error("Almacenamiento no configurado (faltan variables SPACES_* en Render).");
  await s3().send(new PutObjectCommand({ Bucket: env("SPACES_BUCKET"), Key: key, Body: body, ContentType: contentType, ACL: "private" }));
}

export async function deleteFile(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env("SPACES_BUCKET"), Key: key }));
}

/** URL firmada de descarga válida por `expiresIn` segundos (por defecto 10 minutos). */
export async function downloadUrl(key: string, filename: string, expiresIn = 600): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: env("SPACES_BUCKET"), Key: key, ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"` }),
    { expiresIn }
  );
}
