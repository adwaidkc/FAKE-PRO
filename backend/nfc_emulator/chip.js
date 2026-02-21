// backend/nfc_emulator/chip.js

import crypto from "crypto";
import { prisma } from "../prismaClient.js";



export async function signChallenge(productId, challenge) {
  const records = await prisma.product.findMany({
    where: { productId },
    select: { nfcSecret: true },
    take: 2
  });


  if (records.length === 0) {
    throw new Error("Unknown NFC chip / secret not found");
  }

  if (records.length > 1) {
    throw new Error("Ambiguous productId across manufacturers");
  }

  const secret = records[0].nfcSecret;

  return crypto
    .createHash("sha256")
    .update(secret + challenge)
    .digest("hex");
}

