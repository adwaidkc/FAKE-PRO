#!/usr/bin/env node
import { prisma } from "../prismaClient.js";

const boxes = process.argv.slice(2);

if (!boxes.length) {
  console.error("Usage: node scripts/clear-retailer-assignments.js <boxId> [boxId...]");
  process.exit(1);
}

async function main() {
  for (const boxId of boxes) {
    const result = await prisma.box.updateMany({
      where: { boxId },
      data: {
        retailerId: null,
        retailerEmail: null
      }
    });
    const label = `Box ${boxId}`;
    if (result.count === 0) {
      console.warn(`${label} not found or already cleared.`);
    } else {
      console.log(`${label} assignment cleared (${result.count} rows).`);
    }
  }
}

main()
  .catch((err) => {
    console.error("Failed to clear box assignments:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
