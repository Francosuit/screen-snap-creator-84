const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256Hex(value: string): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
export function equalHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function encryptionKey(root: string): Promise<CryptoKey> {
  if (!root || root.length < 32) throw new Error("API credential encryption is not configured");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`suite-api-credential-v1:${root}`),
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
/** Only the ciphertext is persisted. The raw signing secret is returned once by the creation/rotation RPC. */
export async function sealSigningSecret(secret: string, root: string): Promise<string> {
  const iv = randomBytes(12);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      await encryptionKey(root),
      encoder.encode(secret),
    ),
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(encrypted)}`;
}
export async function openSigningSecret(payload: string, root: string): Promise<string> {
  const parts = payload.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") throw new Error("Invalid encrypted credential");
  try {
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(parts[1]!) as BufferSource },
      await encryptionKey(root),
      base64ToBytes(parts[2]!) as BufferSource,
    );
    return decoder.decode(clear);
  } catch {
    throw new Error("Invalid encrypted credential");
  }
}
export interface NewSuiteCredentials {
  apiKey: string;
  keyPrefix: string;
  keyHash: string;
  signingSecret: string;
  encryptedSecret: string;
  encryptedApiKey: string;
}
export async function newSuiteCredentials(root: string): Promise<NewSuiteCredentials> {
  const apiKey = `sk_suite_${hex(randomBytes(32))}`;
  const signingSecret = `whsec_suite_${hex(randomBytes(32))}`;
  return {
    apiKey,
    keyPrefix: apiKey.slice(0, 25),
    keyHash: await sha256Hex(apiKey),
    signingSecret,
    encryptedSecret: await sealSigningSecret(signingSecret, root),
    encryptedApiKey: await sealSigningSecret(apiKey, root),
  };
}
export async function signSuiteBody(
  body: string,
  secret: string,
  timestamp: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return `sha256=${hex(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`))))}`;
}
export async function verifySuiteSignature(
  body: string,
  headers: Headers,
  secret: string,
  now: Date,
): Promise<boolean> {
  const timestamp = headers.get("X-Suite-Timestamp");
  const signature = headers.get("X-Suite-Signature-256");
  if (
    !timestamp ||
    !/^\d{1,12}$/.test(timestamp) ||
    !signature ||
    !/^sha256=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (
    Math.abs(now.getTime() - Number(timestamp) * 1000) > 300000 ||
    encoder.encode(body).byteLength > 262144
  )
    return false;
  return equalHex(signature.slice(7), (await signSuiteBody(body, secret, timestamp)).slice(7));
}
export function suiteApiHeaders(
  body: string,
  apiKey: string,
  signingSecret: string,
  timestamp: string,
  signature: string,
): Headers {
  return new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Suite-Timestamp": timestamp,
    "X-Suite-Signature-256": signature,
    "Idempotency-Key": JSON.parse(body).event_id,
  });
}
