// src/components/ManufacturerDashboard.jsx

import { useState } from "react";
import {
  connectBlockchain,
  registerBatch,
  shipBox,
  getProduct,
  getProductIdsByBox
} from "../../trustChain";
import "../../index2.css";

/* ================= DEFAULT BATCH TEMPLATE ================= */

const defaultBatch = {
  batchId: "BATCH-567",
  boxId: "BOX-001",
  batchSize: 5,
  startProductId: "P1001",

  // Product template
  name: "Smartphone X",
  category: "Smartphone",
  manufacturer: "TechCorp Ltd.",
  manufacturerDate: "2025-12-10",
  manufacturePlace: "Bangalore, India",
  modelNumber: "X1000",
  warrantyPeriod: "24 months",
  color: "Black",
  price: 65000,
  image: "/mob.jpg"
};

const getStatusTone = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return "info";
  if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found")) return "error";
  if (text.includes("⚠") || text.includes("required") || text.includes("mismatch")) return "warning";
  if (text.includes("⏳") || text.includes("loading") || text.includes("fetching") || text.includes("registering")) return "info";
  if (text.includes("✅") || text.includes("connected") || text.includes("success")) return "success";
  return "info";
};

const ManufacturerDashboard = () => {
  const [batch, setBatch] = useState(defaultBatch);
  const [status, setStatus] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [activeAction, setActiveAction] = useState("register");
  const [batchCreated, setBatchCreated] = useState(false);

  const [boxId, setBoxId] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);

  const [searchProductId, setSearchProductId] = useState("");
  const [fetchedProduct, setFetchedProduct] = useState(null);

  /* ================= CONNECT WALLET ================= */

  const handleConnect = async () => {
    try {
      const address = await connectBlockchain();
      setWalletConnected(true);
      setWalletAddress(address || "");
      setStatus(`✅ Wallet connected: ${address || "-"}`);
    } catch (err) {
      console.error(err);
      setWalletAddress("");
      setStatus("❌ Wallet connection failed");
    }
  };

  /* ================= CREATE & REGISTER BATCH ================= */

const handleCreateBatch = async () => {
  if (!walletConnected) {
    setStatus("❌ Connect wallet first before creating/registering a batch.");
    return;
  }
  setStatus("⏳ Registering batch...");

  const result = await registerBatch(batch);

  if (!result.success) {
    setStatus("❌ " + result.message);
    return;
  }

  setBatchCreated(true);

  const start = parseInt(batch.startProductId.replace(/\D/g, ""));
  const end = start + batch.batchSize - 1;

  setStatus(
    `✅ Batch registered successfully.
Products created: P${start} → P${end}`
  );
};



  /* ================= FETCH BOX ================= */

  const handleFetchBox = async () => {
    try {
      setStatus("⏳ Fetching box...");
      const ids = await getProductIdsByBox(boxId);
      const products = [];

      for (let pid of ids) {
        const p = await getProduct(pid);
        products.push(p);
      }

      setBoxProducts(products);
      setStatus(`📦 Box ${boxId} contains ${products.length} products`);
    } catch {
      setBoxProducts([]);
      setStatus("❌ Box not found");
    }
  };

  /* ================= SHIP BOX ================= */

  const handleShipBox = async () => {
  if (!walletConnected) {
    setStatus("❌ Connect wallet first before shipping.");
    return;
  }
  try {
    setStatus("⏳ Shipping box...");
    await shipBox(boxId); // ✅ ONE transaction
    setStatus("✅ Box shipped successfully");
  } catch (err) {
    console.error(err);
    setStatus("❌ Shipping failed");
  }
};


  /* ================= FETCH PRODUCT ================= */

  const handleFetchProduct = async () => {
    try {
      const p = await getProduct(searchProductId);
      setFetchedProduct(p);
      setStatus("");
    } catch {
      setFetchedProduct(null);
      setStatus("❌ Product not found");
    }
  };

  /* ================= UI ================= */

  return (
    <div className="premium-dashboard" style={{ width: "100vw", padding: "20px" }}>
      <h2>Manufacturer Dashboard</h2>

      {/* WALLET */}
      <div className="center" style={{ marginBottom: "20px" }}>
        <button
          className="btn-primary"
          onClick={handleConnect}
          style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
        >
          {walletConnected ? "Connected" : "Connect Wallet"}
        </button>
        {walletConnected && (
          <div style={{ marginTop: 8, color: "#9bd4ff", fontSize: 13 }}>
            Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
          </div>
        )}
      </div>

      {/* ACTION SWITCH */}
      <div className="center" style={{ marginBottom: "20px" }}>
        <button className="btn-outline" onClick={() => setActiveAction("register")}>
          Register Batch
        </button>
        <span style={{ margin: "0 8px" }} />
        <button className="btn-outline" onClick={() => setActiveAction("ship")}>
          Ship Box
        </button>
        <span style={{ margin: "0 8px" }} />
        <button className="btn-outline" onClick={() => setActiveAction("fetch")}>
          Fetch Product
        </button>
      </div>

      {/* ================= REGISTER BATCH ================= */}
      {activeAction === "register" && (
        <div className="product-form" style={{ paddingTop: "1px" }}>
          <h3>Batch Details</h3>
          <div className="form-row" style={{ paddingBottom: "4px" }}>
            <div className="form-group">
              <label>Batch ID</label>
              <input disabled={batchCreated} placeholder="Batch ID"
                value={batch.batchId}
                onChange={e => setBatch({ ...batch, batchId: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Box ID</label>
              <input disabled={batchCreated} placeholder="Box ID"
                value={batch.boxId}
                onChange={e => setBatch({ ...batch, boxId: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Box Size</label>
              <input disabled={batchCreated} type="number" placeholder="Batch Size"
                value={batch.batchSize}
                onChange={e => setBatch({ ...batch, batchSize: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Start Product ID</label>
              <input disabled={batchCreated} placeholder="Start Product ID"
                value={batch.startProductId}
                onChange={e => setBatch({ ...batch, startProductId: e.target.value })} />
            </div>
          </div>

          <h3>Product Template</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Product Name</label>
              <input disabled={batchCreated} placeholder="Product Name"
                value={batch.name}
                onChange={e => setBatch({ ...batch, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input disabled={batchCreated} placeholder="Category"
                value={batch.category}
                onChange={e => setBatch({ ...batch, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Model Number</label>
              <input disabled={batchCreated} placeholder="Model Number"
                value={batch.modelNumber}
                onChange={e => setBatch({ ...batch, modelNumber: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Color</label>
              <input disabled={batchCreated} placeholder="Color"
                value={batch.color}
                onChange={e => setBatch({ ...batch, color: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Warranty</label>
              <input disabled={batchCreated} placeholder="Warranty"
                value={batch.warrantyPeriod}
                onChange={e => setBatch({ ...batch, warrantyPeriod: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Price</label>
              <input disabled={batchCreated} type="number" placeholder="Price"
                value={batch.price}
                onChange={e => setBatch({ ...batch, price: Number(e.target.value) })} />
            </div>
          </div>

          <button
            className="btn-primary"
            disabled={batchCreated}
            onClick={handleCreateBatch}
            style={{ marginTop: "16px" }}
          >
            Create & Register Batch
          </button>

          {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
        </div>
      )}

      {/* ================= SHIP BOX ================= */}
      {activeAction === "ship" && (
        <div className="product-form" style={{ paddingTop: "1px" }}>
          <h3>Ship Box</h3>
          <div className="form-row" style={{ paddingBottom: "4px" }}>
            <div className="form-group">
              <label>Box ID</label>
              <input
                placeholder="Enter Box ID"
                value={boxId}
                onChange={e => setBoxId(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: "12px" }}>
            <button className="btn-outline" onClick={handleFetchBox}>
              Fetch Box
            </button>
          </div>
          {boxProducts.length > 0 && (
            <div className="form-row" style={{ marginBottom: "12px" }}>
              <button className="btn-primary" onClick={handleShipBox}>
                Ship All ({boxProducts.length})
              </button>
            </div>
          )}
          {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
        </div>
      )}

      {/* ================= FETCH PRODUCT ================= */}
      {activeAction === "fetch" && (
        <div className="product-form" style={{ paddingTop: "1px" }}>
          <h3>Fetch Product</h3>
          <div className="form-row" style={{ paddingBottom: "4px" }}>
            <div className="form-group">
              <label>Product ID</label>
              <input
                placeholder="Enter Product ID"
                value={searchProductId}
                onChange={e => setSearchProductId(e.target.value)}
              />
            </div>
          </div>
          <div className="form-row" style={{ marginBottom: "12px" }}>
            <button className="btn-outline" onClick={handleFetchProduct}>
              Fetch
            </button>
          </div>
          {fetchedProduct && (
            <div
              className="fetched-product-card"
              style={{
                marginTop: "16px",
                display: "flex",
                alignItems: "center",
                gap: "24px"
              }}
            >
              <h4 style={{ margin: 0 }}>{fetchedProduct.name}</h4>
              <p style={{ margin: 0 }}>Product ID: {fetchedProduct.productId}</p>
              <p style={{ margin: 0 }}>Box ID: {fetchedProduct.boxId}</p>
              <p style={{ margin: 0 }}>Shipped: {fetchedProduct.shipped ? "Yes" : "No"}</p>
            </div>
          )}
          {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
        </div>
      )}
    </div>
  );
};

export default ManufacturerDashboard;
