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

const resolveContractAbi = () => {
  const candidates = [
    path.join(__dirname, "..", "artifacts", "contracts", "TrustChain.sol", "TrustChain.json"),
    path.join(__dirname, "..", "src", "TrustChainAbi.json"),
    path.join(__dirname, "abi.json")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf-8"));
      if (Array.isArray(parsed)) return parsed;
      if (Array.isArray(parsed.abi)) return parsed.abi;
    } catch (err) {
      console.warn("⚠️ Failed to parse ABI candidate:", candidate, err.message);
    }
  }

  throw new Error("Unable to load contract ABI from known paths");
};

const abi = resolveContractAbi();
const registerBatchInterface = new ethers.Interface([
  "function registerBatchProducts(string batchNumber,string boxId,(string productId,string boxId,string name,string category,string manufacturer,string manufacturerDate,string manufacturePlace,string modelNumber,string serialNumber,string warrantyPeriod,string batchNumber,string color,string specs,uint256 price,string image)[] items)"
]);

/* ================= APP SETUP ================= */

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());


app.use("/api/auth", authRoutes);

function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

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

async function getMutationManufacturerIdResolved(req, res) {
  if (req.user.role === "MANUFACTURER") return req.user.userId;

  const raw = req.body?.manufacturerId ?? req.query.manufacturerId;
  const parsed = Number.parseInt(String(raw || ""), 10);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;

  if (req.user.role === "ADMIN") {
    res.status(400).json({ error: "manufacturerId is required for admin actions" });
    return null;
  }

  const boxId = String(req.params?.boxId || "").trim();
  if (boxId) {
    const matches = await prisma.box.findMany({
      where: { boxId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 2
    });

    if (matches.length === 1) return matches[0].manufacturerId;
    if (matches.length > 1) {
      res.status(409).json({ error: "Multiple manufacturers found for this boxId; provide manufacturerId" });
      return null;
    }
  }

  const productId = String(req.params?.productId || "").trim();
  if (productId) {
    const matches = await prisma.product.findMany({
      where: { productId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 2
    });

    if (matches.length === 1) return matches[0].manufacturerId;
    if (matches.length > 1) {
      res.status(409).json({ error: "Multiple manufacturers found for this productId; provide manufacturerId" });
      return null;
    }
  }

  res.status(404).json({ error: "Manufacturer mapping not found for this request" });
  return null;
}

async function normalizeLifecycle(whereBase) {
  await prisma.product.updateMany({
    where: { ...whereBase, sold: true },
    data: { lifecycle: "SOLD" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: true },
    data: { lifecycle: "VERIFIED" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: false, shipped: true },
    data: { lifecycle: "SHIPPED" }
  });
  await prisma.product.updateMany({
    where: { ...whereBase, sold: false, verified: false, shipped: false },
    data: { lifecycle: "CREATED" }
  });
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

app.get("/api/db/resolve/box/:boxId", authenticate, async (req, res) => {
  try {
    const boxId = String(req.params.boxId || "").trim();
    if (!boxId) {
      return res.status(400).json({ error: "boxId is required" });
    }

    const matches = await prisma.box.findMany({
      where: { boxId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 20
    });

    if (matches.length === 0) {
      return res.status(404).json({ error: "Box not found" });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        error: "Multiple manufacturers found for this boxId; provide manufacturerId",
        manufacturerIds: matches.map((m) => m.manufacturerId)
      });
    }

    return res.json({ manufacturerId: matches[0].manufacturerId });
  } catch (err) {
    console.error("❌ Box manufacturer resolve failed:", err);
    res.status(500).json({ error: "Box manufacturer resolve failed" });
  }
});

app.get("/api/db/resolve/product/:productId", authenticate, async (req, res) => {
  try {
    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const matches = await prisma.product.findMany({
      where: { productId },
      select: { manufacturerId: true },
      distinct: ["manufacturerId"],
      take: 20
    });

    if (matches.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    if (matches.length > 1) {
      return res.status(409).json({
        error: "Multiple manufacturers found for this productId; provide manufacturerId",
        manufacturerIds: matches.map((m) => m.manufacturerId)
      });
    }

    return res.json({ manufacturerId: matches[0].manufacturerId });
  } catch (err) {
    console.error("❌ Product manufacturer resolve failed:", err);
    res.status(500).json({ error: "Product manufacturer resolve failed" });
  }
});

app.get("/api/admin/manufacturers", authenticate, requireAdmin, async (req, res) => {
  try {
    const manufacturers = await prisma.user.findMany({
      where: { role: "MANUFACTURER" },
      select: { id: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" }
    });

    if (manufacturers.length === 0) {
      return res.json({ manufacturers: [] });
    }

    const [totals, shipped, verified, sold, latestProductAt, boxCounts] = await Promise.all([
      prisma.product.groupBy({
        by: ["manufacturerId"],
        _count: { _all: true }
      }),
      prisma.product.groupBy({
        by: ["manufacturerId"],
        where: { shipped: true },
        _count: { _all: true }
      }),
      prisma.product.groupBy({
        by: ["manufacturerId"],
        where: { verified: true },
        _count: { _all: true }
      }),
      prisma.product.groupBy({
        by: ["manufacturerId"],
        where: { sold: true },
        _count: { _all: true }
      }),
      prisma.product.groupBy({
        by: ["manufacturerId"],
        _max: { createdAt: true }
      }),
      prisma.box.groupBy({
        by: ["manufacturerId"],
        _count: { _all: true }
      })
    ]);

    const totalMap = new Map(totals.map((x) => [x.manufacturerId, x._count._all]));
    const shippedMap = new Map(shipped.map((x) => [x.manufacturerId, x._count._all]));
    const verifiedMap = new Map(verified.map((x) => [x.manufacturerId, x._count._all]));
    const soldMap = new Map(sold.map((x) => [x.manufacturerId, x._count._all]));
    const latestMap = new Map(latestProductAt.map((x) => [x.manufacturerId, x._max.createdAt]));
    const boxMap = new Map(boxCounts.map((x) => [x.manufacturerId, x._count._all]));

    const payload = manufacturers.map((m) => ({
      id: m.id,
      email: m.email,
      createdAt: m.createdAt,
      totalBoxes: boxMap.get(m.id) || 0,
      totalProducts: totalMap.get(m.id) || 0,
      shippedProducts: shippedMap.get(m.id) || 0,
      verifiedProducts: verifiedMap.get(m.id) || 0,
      soldProducts: soldMap.get(m.id) || 0,
      latestProductAt: latestMap.get(m.id) || null
    }));

    return res.json({ manufacturers: payload });
  } catch (err) {
    console.error("❌ Admin manufacturers query failed:", err);
    res.status(500).json({ error: "Admin manufacturers query failed" });
  }
});

app.get("/api/admin/batches", authenticate, requireAdmin, async (req, res) => {
  try {
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;

    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const groups = await prisma.product.groupBy({
      by: ["manufacturerId", "batchId"],
      where: manufacturerId ? { manufacturerId } : undefined,
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: [{ _max: { createdAt: "desc" } }]
    });

    return res.json({
      batches: groups.map((g) => ({
        manufacturerId: g.manufacturerId,
        batchId: g.batchId,
        productCount: g._count._all,
        latestProductAt: g._max.createdAt
      }))
    });
  } catch (err) {
    console.error("❌ Admin batches query failed:", err);
    res.status(500).json({ error: "Admin batches query failed" });
  }
});

app.get("/api/admin/boxes", authenticate, requireAdmin, async (req, res) => {
  try {
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const batchId = String(req.query.batchId || "").trim();
    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;

    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const boxes = await prisma.box.findMany({
      where: {
        ...(manufacturerId ? { manufacturerId } : {}),
        ...(batchId ? { batchId } : {})
      },
      select: {
        manufacturerId: true,
        boxId: true,
        batchId: true,
        _count: {
          select: {
            products: true
          }
        }
      },
      orderBy: [
        { createdAt: "desc" }
      ]
    });

    return res.json({
      boxes: boxes.map((b) => ({
        manufacturerId: b.manufacturerId,
        boxId: b.boxId,
        batchId: b.batchId,
        productCount: b._count.products
      }))
    });
  } catch (err) {
    console.error("❌ Admin boxes query failed:", err);
    res.status(500).json({ error: "Admin boxes query failed" });
  }
});

app.get("/api/admin/products", authenticate, requireAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "ALL").trim().toUpperCase();
    const batchId = String(req.query.batchId || "").trim();
    const boxId = String(req.query.boxId || "").trim();
    const fromDate = String(req.query.fromDate || "").trim();
    const toDate = String(req.query.toDate || "").trim();
    const rawManufacturerId = String(req.query.manufacturerId || "").trim();
    const sortBy = String(req.query.sortBy || "createdAt").trim();
    const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(Number.parseInt(String(req.query.page || "1"), 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(String(req.query.pageSize || "25"), 10) || 25, 1), 100);

    const manufacturerId = rawManufacturerId ? Number.parseInt(rawManufacturerId, 10) : null;
    if (rawManufacturerId && (Number.isNaN(manufacturerId) || manufacturerId <= 0)) {
      return res.status(400).json({ error: "manufacturerId must be a valid integer" });
    }

    const createdAt = {};
    if (fromDate) createdAt.gte = new Date(`${fromDate}T00:00:00.000Z`);
    if (toDate) createdAt.lte = new Date(`${toDate}T23:59:59.999Z`);

    const where = {
      ...(manufacturerId ? { manufacturerId } : {}),
      ...(batchId ? { batchId } : {}),
      ...(boxId ? { box: { boxId: { contains: boxId, mode: "insensitive" } } } : {}),
      ...(fromDate || toDate ? { createdAt } : {}),
      ...(status !== "ALL" ? { lifecycle: status } : {})
    };

    const orderByMap = {
      createdAt: { createdAt: sortOrder },
      batchId: { batchId: sortOrder },
      productId: { productId: sortOrder },
      lifecycle: { lifecycle: sortOrder },
      manufacturer: { manufacturer: { email: sortOrder } },
      boxId: { box: { boxId: sortOrder } }
    };
    const orderBy = orderByMap[sortBy] || orderByMap.createdAt;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          manufacturer: {
            select: {
              id: true,
              email: true
            }
          },
          box: {
            select: {
              id: true,
              boxId: true,
              shippingAddress: true
            }
          }
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const productsWithDerivedLifecycle = products.map((p) => {
      let lifecycle = "CREATED";
      if (p.sold) lifecycle = "SOLD";
      else if (p.verified) lifecycle = "VERIFIED";
      else if (p.shipped) lifecycle = "SHIPPED";

      return {
        ...p,
        lifecycle
      };
    });

    return res.json({
      page,
      pageSize,
      total,
      products: productsWithDerivedLifecycle
    });
  } catch (err) {
    console.error("❌ Admin products query failed:", err);
    res.status(500).json({ error: "Admin products query failed" });
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
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;
    const boxId = String(req.params.boxId || "").trim();
    const shippingAddress = String(req.body?.shippingAddress || "").trim();

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

    if (shippingAddress) {
      await prisma.box.update({
        where: {
          manufacturerId_boxId: {
            manufacturerId,
            boxId
          }
        },
        data: {
          shippingAddress
        }
      });
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

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

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

app.post("/api/db/box/:boxId/verify", authenticate, async (req, res) => {
  try {
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
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
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id,
        sold: false
      },
      data: {
        verified: true
      }
    });

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

    const verifiedCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        verified: true
      }
    });

    return res.json({ boxId, verifiedCount });
  } catch (err) {
    console.error("❌ Box verify sync failed:", err);
    res.status(500).json({ error: "Box verify sync failed" });
  }
});

app.post("/api/db/box/:boxId/sold", authenticate, async (req, res) => {
  try {
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
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
      }
    });

    if (!box) {
      return res.status(404).json({ error: "Box not found" });
    }

    await prisma.product.updateMany({
      where: {
        manufacturerId,
        boxId: box.id
      },
      data: {
        sold: true,
        verified: true,
        shipped: true
      }
    });

    await normalizeLifecycle({ manufacturerId, boxId: box.id });

    const soldCount = await prisma.product.count({
      where: {
        manufacturerId,
        boxId: box.id,
        sold: true
      }
    });

    return res.json({ boxId, soldCount });
  } catch (err) {
    console.error("❌ Box sold sync failed:", err);
    res.status(500).json({ error: "Box sold sync failed" });
  }
});

app.post("/api/db/product/:productId/verify", authenticate, async (req, res) => {
  try {
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const updated = await prisma.product.updateMany({
      where: {
        manufacturerId,
        productId,
        sold: false
      },
      data: {
        verified: true
      }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await normalizeLifecycle({ manufacturerId, productId });

    return res.json({ productId, updated: true });
  } catch (err) {
    console.error("❌ Product verify sync failed:", err);
    res.status(500).json({ error: "Product verify sync failed" });
  }
});

app.post("/api/db/product/:productId/sold", authenticate, async (req, res) => {
  try {
    const manufacturerId = await getMutationManufacturerIdResolved(req, res);
    if (!manufacturerId) return;

    const productId = String(req.params.productId || "").trim();
    if (!productId) {
      return res.status(400).json({ error: "productId is required" });
    }

    const updated = await prisma.product.updateMany({
      where: {
        manufacturerId,
        productId
      },
      data: {
        sold: true
      }
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    await normalizeLifecycle({ manufacturerId, productId });

    return res.json({ productId, updated: true });
  } catch (err) {
    console.error("❌ Product sold sync failed:", err);
    res.status(500).json({ error: "Product sold sync failed" });
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

const DRAFT_TTL_MS = 15 * 60 * 1000;
const DRAFT_SECRET = process.env.JWT_SECRET || process.env.PRIVATE_KEY || "draft-secret";

function encodeBase64Url(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signDraft(payloadObj) {
  const payload = encodeBase64Url(JSON.stringify(payloadObj));
  const signature = crypto.createHmac("sha256", DRAFT_SECRET).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

function verifyDraft(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac("sha256", DRAFT_SECRET).update(payload).digest("hex");

  if (signature !== expected) return null;

  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
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
    if (req.user.role !== "MANUFACTURER") {
      return res.status(403).json({ error: "Manufacturer access required" });
    }

    const batchId = String(batch.batchId || "").trim();
    const boxId = String(batch.boxId || "").trim();
    const batchSize = Number.parseInt(String(batch.batchSize || "0"), 10);
    const startRaw = String(batch.startProductId || "").trim();
    const startNum = Number.parseInt(startRaw.replace(/\D/g, ""), 10);

    if (!batchId || !boxId || !startRaw || Number.isNaN(startNum) || startNum <= 0 || Number.isNaN(batchSize) || batchSize <= 0) {
      return res.status(400).json({ error: "Invalid batch payload" });
    }

    const existingBox = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId
        }
      }
    });

    if (existingBox) {
      return res.status(400).json({
        error: `Box ${boxId} already exists`
      });
    }

    const batchSecret = crypto.randomBytes(32).toString("hex");
    const items = [];
    const productRows = [];
    const candidateProductIds = [];

    for (let i = 0; i < batchSize; i++) {
      const productId = `P${startNum + i}`;
      const serialNumber = `${batchId}-SN-${i + 1}`;
      candidateProductIds.push(productId);

      const productSecret = crypto
        .createHash("sha256")
        .update(batchSecret + productId)
        .digest("hex");

      productRows.push({
        productId,
        nfcSecret: productSecret,
        batchId
      });

      items.push({
        productId,
        boxId,
        name: batch.name,
        category: batch.category,
        manufacturer: batch.manufacturer,
        manufacturerDate: batch.manufacturerDate,
        manufacturePlace: batch.manufacturePlace,
        modelNumber: batch.modelNumber,
        serialNumber,
        warrantyPeriod: batch.warrantyPeriod,
        batchNumber: batchId,
        color: batch.color,
        specs: JSON.stringify({ batch: batchId }),
        price: batch.price,
        image: batch.image
      });
    }

    const existingProducts = await prisma.product.findMany({
      where: {
        manufacturerId,
        productId: {
          in: candidateProductIds
        }
      },
      select: {
        productId: true
      }
    });

    if (existingProducts.length > 0) {
      return res.status(400).json({
        error: `Product ${existingProducts[0].productId} already exists`
      });
    }

    const draftPayload = {
      manufacturerId,
      createdAt: Date.now(),
      batch: {
        batchId,
        boxId,
        batchSize,
        startProductId: startRaw
      },
      items,
      productRows
    };
    const draftToken = signDraft(draftPayload);

    return res.json({
      draftToken,
      batchId,
      boxId,
      items
    });

  } catch (err) {
    console.error("❌ Batch preparation failed:", err);
    res.status(500).json({ error: "Batch preparation failed" });
  }
});

app.post("/finalize-batch", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "MANUFACTURER") {
      return res.status(403).json({ error: "Manufacturer access required" });
    }

    const manufacturerId = req.user.userId;
    const draftToken = String(req.body?.draftToken || "").trim();
    const txHash = String(req.body?.txHash || "").trim();

    if (!draftToken || !txHash) {
      return res.status(400).json({ error: "draftToken and txHash are required" });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({ error: "Invalid txHash format" });
    }

    const draft = verifyDraft(draftToken);
    if (!draft) {
      return res.status(400).json({ error: "Invalid draft token" });
    }
    if (draft.manufacturerId !== manufacturerId) {
      return res.status(403).json({ error: "Draft does not belong to this manufacturer" });
    }
    if (!draft.createdAt || (Date.now() - Number(draft.createdAt)) > DRAFT_TTL_MS) {
      return res.status(400).json({ error: "Draft expired. Prepare batch again." });
    }

    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash)
    ]);

    if (!tx || !receipt) {
      return res.status(400).json({ error: "Transaction not found or not mined yet" });
    }
    if (receipt.status !== 1) {
      return res.status(400).json({ error: "Transaction reverted on-chain" });
    }
    if (!tx.to || tx.to.toLowerCase() !== String(process.env.CONTRACT_ADDRESS).toLowerCase()) {
      return res.status(400).json({ error: "Transaction target contract mismatch" });
    }

    let parsed;
    try {
      parsed = registerBatchInterface.parseTransaction({
        data: tx.data,
        value: tx.value
      });
    } catch {
      const selector = String(tx.data || "").slice(0, 10);
      return res.status(400).json({ error: `Unexpected transaction method selector ${selector}` });
    }

    const [txBatchId, txBoxId, txItems] = parsed.args;
    if (String(txBatchId) !== String(draft.batch.batchId) || String(txBoxId) !== String(draft.batch.boxId)) {
      return res.status(400).json({ error: "Transaction batch details do not match prepared draft" });
    }
    if (!Array.isArray(txItems) || txItems.length !== draft.items.length) {
      return res.status(400).json({ error: "Transaction item count mismatch" });
    }

    for (let i = 0; i < draft.items.length; i++) {
      const expected = draft.items[i];
      const actual = txItems[i];
      if (
        String(actual.productId) !== String(expected.productId) ||
        String(actual.boxId) !== String(expected.boxId) ||
        String(actual.batchNumber) !== String(expected.batchNumber) ||
        String(actual.serialNumber) !== String(expected.serialNumber) ||
        String(actual.price) !== String(expected.price)
      ) {
        return res.status(400).json({ error: "Transaction payload does not match prepared draft" });
      }
    }

    const existingBox = await prisma.box.findUnique({
      where: {
        manufacturerId_boxId: {
          manufacturerId,
          boxId: draft.batch.boxId
        }
      },
      select: {
        id: true
      }
    });

    if (existingBox) {
      const existingCount = await prisma.product.count({
        where: {
          manufacturerId,
          box: {
            boxId: draft.batch.boxId
          },
          productId: {
            in: draft.productRows.map((p) => p.productId)
          }
        }
      });
      if (existingCount === draft.productRows.length) {
        return res.json({ finalized: true, alreadyFinalized: true, txHash });
      }
      return res.status(409).json({ error: "Box already exists with inconsistent data" });
    }

    await prisma.$transaction(async (txClient) => {
      const createdBox = await txClient.box.create({
        data: {
          boxId: draft.batch.boxId,
          batchId: draft.batch.batchId,
          manufacturerId
        }
      });

      await txClient.product.createMany({
        data: draft.productRows.map((row) => ({
          productId: row.productId,
          nfcSecret: row.nfcSecret,
          manufacturerId,
          boxId: createdBox.id,
          batchId: row.batchId
        }))
      });
    });

    return res.json({ finalized: true, txHash });
  } catch (err) {
    console.error("❌ Batch finalization failed:", err);
    res.status(500).json({ error: "Batch finalization failed" });
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
