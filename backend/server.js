import cors from "cors";
import express from "express";
import crypto from "crypto";
import { ethers } from "ethers";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { signChallenge } from "./nfc_emulator/chip.js";

import { prisma } from "./prismaClient.js";
import { authenticate } from "./middleware/auth.middleware.js";
import authRoutes from "./routes/auth.routes.js";



dotenv.config();

/* ================= PATH UTILS ================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ================= LOAD ABI ================= */

const abiPath = path.join(__dirname, "abi.json");
const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));

/* ================= APP SETUP ================= */

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());


app.use("/api/auth", authRoutes);

function getScopedManufacturerId(req, res) {
  const isAdmin = req.user.role === "ADMIN";

  if (!isAdmin) return req.user.userId;

  if (!req.query.manufacturerId) return req.user.userId;

  const parsed = Number.parseInt(String(req.query.manufacturerId), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    res.status(400).json({ error: "manufacturerId must be a valid integer" });
    return null;
  }

  return parsed;
}

app.get("/api/db/box/:boxId/products", authenticate, async (req, res) => {
  try {
    const manufacturerId = getScopedManufacturerId(req, res);
    if (!manufacturerId) return;

    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      },
      include: {
        products: {
          select: {
            productId: true,
            batchId: true,
            lifecycle: true,
            shipped: true,
            verified: true,
            sold: true,
            createdAt: true
          },
          orderBy: { productId: "asc" }
        }
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    return res.json({
      box: {
        boxId: box.boxId,
        batchId: box.batchId,
        createdAt: box.createdAt
      },
      products: box.products
    });
  } catch (err) {
    console.error("❌ Box products query failed:", err);
    res.status(500).json({ error: "Box products query failed" });
  }
});

app.get("/api/db/dashboard/summary", authenticate, async (req, res) => {
  try {
    const manufacturerId = getScopedManufacturerId(req, res);
    if (!manufacturerId) return;

    const batchId = String(req.query.batchId || "").trim();

    const productWhere = {
      manufacturerId,
      ...(batchId ? { batchId } : {})
    };

    const boxWhere = {
      manufacturerId,
      ...(batchId ? { batchId } : {})
    };

    const [
      totalProducts,
      shippedProducts,
      verifiedProducts,
      soldProducts,
      totalBoxes,
      recentBoxes
    ] = await Promise.all([
      prisma.product.count({ where: productWhere }),
      prisma.product.count({ where: { ...productWhere, shipped: true } }),
      prisma.product.count({ where: { ...productWhere, verified: true } }),
      prisma.product.count({ where: { ...productWhere, sold: true } }),
      prisma.box.count({ where: boxWhere }),
      prisma.box.findMany({
        where: boxWhere,
        select: {
          boxId: true,
          batchId: true,
          createdAt: true,
          _count: {
            select: { products: true }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 10
      })
    ]);

    return res.json({
      manufacturerId,
      batchId: batchId || null,
      summary: {
        totalBoxes,
        totalProducts,
        shippedProducts,
        verifiedProducts,
        soldProducts,
        pendingProducts: totalProducts - soldProducts
      },
      recentBoxes
    });
  } catch (err) {
    console.error("❌ Dashboard summary query failed:", err);
    res.status(500).json({ error: "Dashboard summary query failed" });
  }
});

app.post("/api/db/box/:boxId/ship", authenticate, async (req, res) => {
  try {
    const manufacturerId = req.user.userId;
    const boxId = String(req.params.boxId || "").trim();

    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const box = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id,
        shipped: false
      },
      data: {
        shipped: true
      }
    });

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id,
        sold: false,
        verified: false,
        lifecycle: "CREATED"
      },
      data: {
        lifecycle: "SHIPPED"
      }
    });

    const shippedCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        shipped: true
      }
    });

    return res.json({
      boxId,
      shippedCount
    });
  } catch (err) {
    console.error("❌ Box ship sync failed:", err);
    res.status(500).json({ error: "Box ship sync failed" });
  }
});
/* ================= BLOCKCHAIN SETUP ================= */

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const contract = new ethers.Contract(
  process.env.CONTRACT_ADDRESS,
  abi,
  wallet
);

/* ================= CHALLENGE STORE ================= */

const activeChallenges = new Map();

/* ================= UTILS ================= */

function generateChallenge() {
  return crypto.randomBytes(8).toString("hex");
}

/* =====================================================
   0️⃣ STORE NFC SECRET (manufacturing time)
   ===================================================== */



/* =====================================================
   1️⃣ CHALLENGE ENDPOINT
   ===================================================== */

app.post("/challenge", async (req, res) => {
  try {
    const { productId } = req.body;

    console.log("🔍 /challenge request:", productId);

    if (!productId) {
      return res.status(400).json({ error: "productId required" });
    }

    let product;
    try {
      product = await contract.getProduct(productId);
    } catch (bcErr) {
      console.error("❌ Blockchain error:", bcErr);
      return res.status(500).json({ error: "Blockchain read failed" });
    }

    // 🔐 SAFETY CHECK
    if (!product || !product.productId || product.productId.length === 0) {
      return res.json({ status: "FAKE", reason: "Not registered" });
    }

    if (!product.shipped || !product.verifiedByRetailer) {
      return res.json({ status: "NOT_READY" });
    }

    const challenge = generateChallenge();
    activeChallenges.set(productId, challenge);

    console.log("✅ Challenge issued:", challenge);
    res.json({ challenge });

  } catch (err) {
    console.error("🔥 Challenge error:", err);
    res.status(500).json({ error: "Challenge generation failed" });
  }
});

app.post("/nfc/sign", async (req, res) => {
  try {
    const { productId, challenge } = req.body;

    console.log("📡 /nfc/sign called");
    console.log("Body:", req.body);

    if (!productId || !challenge) {
      return res.status(400).json({
        error: "productId & challenge required"
      });
    }

    const response = await signChallenge(productId, challenge,);

    res.json({ response });

  } catch (err) {
    console.error("❌ NFC SIGN ERROR:", err.message);
    res.status(400).json({ error: err.message });
  }
});

app.post("/prepare-batch", authenticate, async (req, res) => {
  try {
    const batch = req.body;
    const manufacturerId = req.user.userId;

    const startNum = parseInt(
      batch.startProductId.replace(/\D/g, ""),
      10
    );

    /* ================= CHECK BOX ================= */

    const existingBox = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId: batch.boxId
        }
      }
    });

    if (existingBox) {
      return res.status(400).json({
        error: `Box ${batch.boxId} already exists`
      });
    }

    /* ================= CREATE BOX (ONLY ONCE) ================= */

    const createdBox = await prisma.box.create({
      data: {
        boxId: batch.boxId,
        batchId: batch.batchId,
        manufacturerId
      }
    });

    const batchSecret = crypto.randomBytes(32).toString("hex");

    const items = [];

    /* ================= CREATE PRODUCTS ================= */

    for (let i = 0; i < batch.batchSize; i++) {
      const productId = `P${startNum + i}`;
      const serialNumber = `${batch.batchId}-SN-${i + 1}`;

      const existingProduct = await prisma.product.findUnique({
        where: {
          manufacturerId_productId: {
            manufacturerId,
            productId
          }
        }
      });

      if (existingProduct) {
        return res.status(400).json({
          error: `Product ${productId} already exists`
        });
      }

      const productSecret = crypto
        .createHash("sha256")
        .update(batchSecret + productId)
        .digest("hex");

      await prisma.product.create({
        data: {
          productId,
          nfcSecret: productSecret,
          manufacturerId,
          boxId: createdBox.id,
          batchId: batch.batchId
        }
      });

      items.push({
        productId,
        boxId: batch.boxId,
        name: batch.name,
        category: batch.category,
        manufacturer: batch.manufacturer,
        manufacturerDate: batch.manufacturerDate,
        manufacturePlace: batch.manufacturePlace,
        modelNumber: batch.modelNumber,
        serialNumber,
        warrantyPeriod: batch.warrantyPeriod,
        batchNumber: batch.batchId,
        color: batch.color,
        specs: JSON.stringify({ batch: batch.batchId }),
        price: batch.price,
        image: batch.image
      });
    }

    res.json({ items });

  } catch (err) {
    console.error("❌ Batch preparation failed:", err);
    res.status(500).json({ error: "Batch preparation failed" });
  }
});





/* =====================================================
   2️⃣ VERIFY ENDPOINT
   ===================================================== */

app.post("/verify", async (req, res) => {
  try {
    const { productId, response } = req.body;

    console.log("🔐 /verify request:", productId);

    if (!productId || !response) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const challenge = activeChallenges.get(productId);

    if (!challenge) {
      return res.json({ status: "FAILED", reason: "No active challenge" });
    }

    let expected;
    try {
      expected = await signChallenge(productId, challenge);
    } catch (nfcErr) {
      console.error("❌ NFC error:", nfcErr);
      return res.json({ status: "FAKE" });
    }

    activeChallenges.delete(productId); // one-time use

    if (expected !== response) {
      return res.json({ status: "FAKE" });
    }

    const product = await contract.getProduct(productId);

    res.json({
      status: "GENUINE",
      product: {
        productId: product.productId,
        name: product.name,
        image: product.image,
        manufacturer: product.manufacturer,
        shipped: product.shipped,
        verifiedByRetailer: product.verifiedByRetailer,
        sold: product.sold
      }
    });

  } catch (err) {
    console.error("🔥 Verify error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

/* ================= START SERVER ================= */

app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
