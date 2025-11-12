import crypto from "crypto";
const enc = (s: string) => Buffer.from(s).toString("base64url");
export function signPayload(payload: Record<string, unknown>, secret: string) {
  const body = JSON.stringify(payload);
  const sig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${enc(body)}.${sig}`;
}
export function verifyPayload(token: string, secret: string) {
  const [b, sig] = token.split(".");
  const body = Buffer.from(b, "base64url").toString("utf8");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  if (sig !== expected) throw new Error("Invalid signature");
  return JSON.parse(body);
}
