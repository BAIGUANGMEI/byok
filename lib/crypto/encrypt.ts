import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

function getEncryptionKey(): Buffer {
  const key = Buffer.from(getEnv().ENCRYPTION_KEY_BASE64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY_BASE64 must decode to exactly 32 bytes");
  }
  return key;
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  try {
    const [ivPart, tagPart, encryptedPart] = parts;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Failed to decrypt secret");
  }
}
