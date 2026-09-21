import { randomUUID } from "node:crypto";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

function privateObjectDir(): string {
  const value = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return value.replace(/\/+$/, "");
}

function parseObjectPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [, bucketName, ...objectParts] = normalized.split("/");
  if (!bucketName || objectParts.length === 0) throw new Error("Invalid object path");
  return { bucketName, objectName: objectParts.join("/") };
}

async function signObjectUrl(objectPath: string, method: "GET" | "PUT", ttlSeconds: number) {
  const { bucketName, objectName } = parseObjectPath(objectPath);
  const response = await fetch(`${SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Object storage signing failed with ${response.status}`);
  const body = await response.json() as { signed_url?: string };
  if (!body.signed_url) throw new Error("Object storage did not return a signed URL");
  return body.signed_url;
}

export function validateAvatarMetadata(input: { size: number; contentType: string }) {
  if (!AVATAR_TYPES.has(input.contentType)) {
    return "Only JPEG, PNG, and WebP images are supported";
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > MAX_AVATAR_SIZE) {
    return "Avatar image must be 5 MB or smaller";
  }
  return null;
}

export async function createAvatarUpload() {
  const fullPath = `${privateObjectDir()}/avatars/${randomUUID()}`;
  return {
    uploadUrl: await signObjectUrl(fullPath, "PUT", 15 * 60),
    objectPath: `/objects/avatars/${fullPath.split("/avatars/")[1]}`,
  };
}

export function isAvatarObjectPath(value: string) {
  return /^\/objects\/avatars\/[0-9a-f-]{36}$/i.test(value);
}

export async function createAvatarReadUrl(objectPath: string) {
  if (!isAvatarObjectPath(objectPath)) throw new Error("Invalid avatar object path");
  const fileName = objectPath.slice("/objects/".length);
  return signObjectUrl(`${privateObjectDir()}/${fileName}`, "GET", 5 * 60);
}