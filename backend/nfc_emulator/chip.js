// backend/nfc_emulator/chip.js

import crypto from "crypto";
import { prisma } from "../prismaClient.js";



export async function signChallenge(productId, challenge) {

  const record = await prisma.productSecret.findFirst({
        where: { productId }
    });


  if (!record) {
    throw new Error("Unknown NFC chip / secret not found");
  }

  const secret = record.secret;

  return crypto
    .createHash("sha256")
    .update(secret + challenge)
    .digest("hex");
}

