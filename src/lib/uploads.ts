// Keep multipart uploads below Vercel’s 4.5 MB function payload ceiling.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export function detectFile(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 5 &&
    String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-"
  )
    return "application/pdf";
  if (
    bytes.length >= 8 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  )
    return "image/png";
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return "image/jpeg";
  return null;
}
export function safeFilename(name: string) {
  return (
    name
      .replace(/[^a-zA-Z0-9._ -]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "document"
  );
}
