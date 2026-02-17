import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { env } from "../config/env";

const algorithm = "aes-256-gcm";
const key = Buffer.from(env.encryptionKeyHex, "hex");

if (key.length !== 32) {
  throw new Error("ENCRYPTION_KEY_HEX must be 32 bytes hex-encoded");
}

export type EncryptedPayload = {
  ivHex: string;
  authTagHex: string;
  ciphertextHex: string;
};

export const encryptText = (plaintext: string): EncryptedPayload => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ivHex: iv.toString("hex"),
    authTagHex: authTag.toString("hex"),
    ciphertextHex: ciphertext.toString("hex")
  };
};

export const decryptText = (payload: EncryptedPayload): string => {
  const decipher = createDecipheriv(algorithm, key, Buffer.from(payload.ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(payload.authTagHex, "hex"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertextHex, "hex")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
};
