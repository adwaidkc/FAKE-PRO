import { ethers } from "ethers";
import TrustChainAbi from "./TrustChainAbi.json";

/* ================= CONFIG ================= */

// Replace the below with your contract address, or use import.meta.env for Vite, or process.env for CRA at build time
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

/* ================= PROVIDER ================= */

const getProvider = () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
};

const buildManufacturerQuery = (manufacturerId) => {
  if (!manufacturerId) return "";
  return `?manufacturerId=${encodeURIComponent(manufacturerId)}`;
};

/* ================= CONTRACT ================= */

const getContract = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({ method: "eth_requestAccounts" });

  const provider = getProvider();
  const signer = await provider.getSigner();

  return new ethers.Contract(CONTRACT_ADDRESS, TrustChainAbi, signer);
};

/* ================= WALLET ================= */

export const connectBlockchain = async () => {
  if (!window.ethereum) throw new Error("MetaMask not found");
  await window.ethereum.request({ method: "eth_requestAccounts" });
  console.log("✅ Wallet connected");
};

/* ================= BACKEND SECRET STORAGE ================= */



/* ================= SECRET HELPERS ================= */



/* ================= ⭐ BATCH REGISTER (PRODUCTION) ================= */

export const registerBatch = async (batch) => {
  try {
    const contract = await getContract();
    const token = localStorage.getItem("token");

    const res = await fetch("http://localhost:5000/prepare-batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(batch)
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.error };
    }

    const { items } = await res.json();

    const tx = await contract.registerBatchProducts(
      batch.batchId,
      batch.boxId,
      items
    );

    await tx.wait();

    return { success: true };

  } catch (err) {

    let message = "Batch registration failed";

    if (err.reason) message = err.reason;
    else if (err.shortMessage) message = err.shortMessage;
    else if (err.message) message = err.message;

    return { success: false, message };
  }
};


/* ================= SHIP ================= */

export const shipBox = async (boxId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.shipBox(boxId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const query = buildManufacturerQuery(manufacturerId);
  const syncRes = await fetch(`http://localhost:5000/api/db/box/${encodeURIComponent(boxId)}/ship${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: manufacturerId ? JSON.stringify({ manufacturerId }) : undefined
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB ship sync failed");
  }

  console.log("📦 Box shipped:", boxId);
};


/* ================= BOX QUERY ================= */

export const getProductIdsByBox = async (boxId) => {
  const contract = await getContract();
  const ids = await contract.getProductsByBox(boxId);
  return ids.map(id => id.toString());
};

/* ================= RETAILER VERIFY ================= */

export const verifyBox = async (boxId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.verifyBox(boxId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const query = buildManufacturerQuery(manufacturerId);
  const syncRes = await fetch(`http://localhost:5000/api/db/box/${encodeURIComponent(boxId)}/verify${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: manufacturerId ? JSON.stringify({ manufacturerId }) : undefined
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB verify sync failed");
  }

  console.log("✅ Box verified by Retailer:", boxId);
};

export const verifyProduct = async (productId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.verifyProduct(productId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const query = buildManufacturerQuery(manufacturerId);
  const syncRes = await fetch(`http://localhost:5000/api/db/product/${encodeURIComponent(productId)}/verify${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: manufacturerId ? JSON.stringify({ manufacturerId }) : undefined
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB verify sync failed");
  }

  console.log("✅ Product verified:", productId);
};

/* ================= SALE ================= */

export const saleComplete = async (productId, manufacturerId = null) => {
  const contract = await getContract();
  const tx = await contract.saleComplete(productId);
  await tx.wait();

  const token = localStorage.getItem("token");
  const query = buildManufacturerQuery(manufacturerId);
  const syncRes = await fetch(`http://localhost:5000/api/db/product/${encodeURIComponent(productId)}/sold${query}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: manufacturerId ? JSON.stringify({ manufacturerId }) : undefined
  });

  if (!syncRes.ok) {
    const err = await syncRes.json().catch(() => ({}));
    throw new Error(err.error || "DB sold sync failed");
  }

  console.log("💰 Sold:", productId);
};

/* ================= FETCH PRODUCT ================= */

export const getProduct = async (productId) => {
  const contract = await getContract();
  const p = await contract.getProduct(productId);

  return {
    productId: p.productId || "",
    boxId: p.boxId || "",
    name: p.name || "",
    category: p.category || "",
    manufacturer: p.manufacturer || "",
    manufacturerDate: p.manufacturerDate || "",
    manufacturePlace: p.manufacturePlace || "",
    modelNumber: p.modelNumber || "",
    serialNumber: p.serialNumber || "",
    warrantyPeriod: p.warrantyPeriod || "",
    batchNumber: p.batchNumber || "",
    color: p.color || "",
    specs: p.specs ? JSON.parse(p.specs) : {},
    price: p.price ? p.price.toString() : "0",
    image: p.image || "",
    shipped: Boolean(p.shipped),
    verifiedByRetailer: Boolean(p.verifiedByRetailer),
    sold: Boolean(p.sold)
  };
};
