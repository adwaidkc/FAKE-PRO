import { useMemo, useState } from "react";
import {
  connectBlockchain,
  registerBatch,
  shipBox,
  getProduct,
  getProductIdsByBox
} from "../../trustChain";
import "../../index2.css";
import "../../manufacturer.css";

const defaultBatch = {
  batchId: "BATCH-567",
  boxId: "BOX-001",
  batchSize: 5,
  startProductId: "P1001",
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

const REG_HISTORY_KEY = "manufacturerRegisterHistory";

const getStatusTone = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return "info";
  if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found")) return "error";
  if (text.includes("⚠") || text.includes("required") || text.includes("mismatch")) return "warning";
  if (text.includes("⏳") || text.includes("loading") || text.includes("fetching") || text.includes("registering")) return "info";
  if (text.includes("✅") || text.includes("connected") || text.includes("success")) return "success";
  return "info";
};

const readHistory = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(REG_HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = (items) => {
  try {
    localStorage.setItem(REG_HISTORY_KEY, JSON.stringify(items.slice(0, 12)));
  } catch {
    // Ignore persistence failures.
  }
};

const ManufacturerDashboard = () => {
  const [batch, setBatch] = useState(defaultBatch);
  const [status, setStatus] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [activeAction, setActiveAction] = useState("register");
  const [batchCreated, setBatchCreated] = useState(false);
  const [registerHistory, setRegisterHistory] = useState(readHistory);

  const [boxId, setBoxId] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);

  const [searchProductId, setSearchProductId] = useState("");
  const [fetchedProduct, setFetchedProduct] = useState(null);
  const [fetchError, setFetchError] = useState("");

  const lastRegisteredText = useMemo(() => {
    if (!registerHistory.length) return "";
    const item = registerHistory[0];
    return `${item.batchId} • ${item.boxId} • ${item.createdRange}`;
  }, [registerHistory]);

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

  const handleCreateBatch = async () => {
    if (!walletConnected) {
      setStatus("❌ Connect wallet first before creating/registering a batch.");
      return;
    }
    setStatus("⏳ Registering batch...");

    const result = await registerBatch(batch);

    if (!result.success) {
      setStatus(`❌ ${result.message}`);
      return;
    }

    setBatchCreated(true);
    const start = parseInt(batch.startProductId.replace(/\D/g, ""), 10);
    const end = start + batch.batchSize - 1;

    const entry = {
      batchId: batch.batchId,
      boxId: batch.boxId,
      totalProducts: batch.batchSize,
      createdRange: `P${start} → P${end}`,
      createdAt: new Date().toISOString()
    };
    const nextHistory = [entry, ...registerHistory];
    setRegisterHistory(nextHistory.slice(0, 12));
    writeHistory(nextHistory);

    setStatus(`✅ Batch registered successfully.\nProducts created: P${start} → P${end}`);
  };

  const handleFetchBox = async () => {
    try {
      setStatus("⏳ Fetching box...");
      const ids = await getProductIdsByBox(boxId);
      const products = [];

      for (const pid of ids) {
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

  const handleShipBox = async () => {
    if (!walletConnected) {
      setStatus("❌ Connect wallet first before shipping.");
      return;
    }
    if (!shippingAddress.trim()) {
      setStatus("⚠ Shipping address is required before shipping.");
      return;
    }
    try {
      setStatus("⏳ Shipping box...");
      await shipBox(boxId, null, shippingAddress);
      setStatus("✅ Box shipped successfully");
    } catch (err) {
      console.error(err);
      setStatus("❌ Shipping failed");
    }
  };

  const handleFetchProduct = async () => {
    try {
      setFetchError("");
      const p = await getProduct(searchProductId);
      setFetchedProduct(p);
      setStatus("");
    } catch {
      setFetchedProduct(null);
      setFetchError("❌ Product not found");
      setStatus("");
    }
  };

  return (
    <div className="manufacturer-page">
      <aside className="manufacturer-sidebar">
        <div className="manufacturer-brand">
          <img src="/bc1.png" alt="TrustChain" />
          <div>
            <h2>TrustChain</h2>
            <p>Manufacturer Console</p>
          </div>
        </div>

        <button
          className={`manufacturer-nav ${activeAction === "register" ? "active" : ""}`}
          onClick={() => setActiveAction("register")}
        >
          Register Batch
        </button>
        <button
          className={`manufacturer-nav ${activeAction === "ship" ? "active" : ""}`}
          onClick={() => setActiveAction("ship")}
        >
          Ship Box
        </button>
        <button
          className={`manufacturer-nav ${activeAction === "fetch" ? "active" : ""}`}
          onClick={() => setActiveAction("fetch")}
        >
          Fetch Product
        </button>

        <div className="manufacturer-sidebar-foot">
          <button
            className="btn-primary"
            onClick={handleConnect}
            style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
          >
            {walletConnected ? "Connected" : "Connect Wallet"}
          </button>
          {walletConnected && (
            <p className="wallet-note">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
            </p>
          )}
          {lastRegisteredText && (
            <p className="wallet-note">Last: {lastRegisteredText}</p>
          )}
        </div>
      </aside>

      <main className="manufacturer-main">
        {activeAction === "register" && (
          <section className="manufacturer-card">
            <h2>Register Batch</h2>

            <div className="product-form" style={{ paddingTop: "1px" }}>
              <h3>Batch Details</h3>
              <div className="form-row" style={{ paddingBottom: "4px" }}>
                <div className="form-group">
                  <label>Batch ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Batch ID"
                    value={batch.batchId}
                    onChange={(e) => setBatch({ ...batch, batchId: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Box ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Box ID"
                    value={batch.boxId}
                    onChange={(e) => setBatch({ ...batch, boxId: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Box Size</label>
                  <input
                    disabled={batchCreated}
                    type="number"
                    placeholder="Batch Size"
                    value={batch.batchSize}
                    onChange={(e) => setBatch({ ...batch, batchSize: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Start Product ID</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Start Product ID"
                    value={batch.startProductId}
                    onChange={(e) => setBatch({ ...batch, startProductId: e.target.value })}
                  />
                </div>
              </div>

              <h3>Product Template</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Product Name"
                    value={batch.name}
                    onChange={(e) => setBatch({ ...batch, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Category"
                    value={batch.category}
                    onChange={(e) => setBatch({ ...batch, category: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Model Number</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Model Number"
                    value={batch.modelNumber}
                    onChange={(e) => setBatch({ ...batch, modelNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Color</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Color"
                    value={batch.color}
                    onChange={(e) => setBatch({ ...batch, color: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Warranty</label>
                  <input
                    disabled={batchCreated}
                    placeholder="Warranty"
                    value={batch.warrantyPeriod}
                    onChange={(e) => setBatch({ ...batch, warrantyPeriod: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input
                    disabled={batchCreated}
                    type="number"
                    placeholder="Price"
                    value={batch.price}
                    onChange={(e) => setBatch({ ...batch, price: Number(e.target.value) })}
                  />
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
            </div>

            {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}
          </section>
        )}

        {activeAction === "ship" && (
          <section className="manufacturer-card">
            <h2>Ship Box</h2>
            <div className="manufacturer-register-layout">
              <div className="product-form" style={{ paddingTop: "1px" }}>
                <div className="form-row" style={{ paddingBottom: "4px" }}>
                  <div className="form-group">
                    <label>Box ID</label>
                    <input
                      placeholder="Enter Box ID"
                      value={boxId}
                      onChange={(e) => setBoxId(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Shipping Address</label>
                    <input
                      placeholder="Enter shipping address"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
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

              <div className="manufacturer-history-card">
                <h3>Previously Registered</h3>
                {!registerHistory.length && <p>No registrations yet.</p>}
                {registerHistory.map((item) => (
                  <div className="manufacturer-history-item" key={`${item.batchId}-${item.boxId}-${item.createdAt}`}>
                    <strong>{item.batchId}</strong>
                    <span>Box: {item.boxId}</span>
                    <span>Products: {item.totalProducts}</span>
                    <span>{item.createdRange}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeAction === "fetch" && (
          <section className="manufacturer-card">
            <h2>Fetch Product</h2>
            <div className="product-form" style={{ paddingTop: "1px" }}>
              <div className="form-row" style={{ paddingBottom: "4px" }}>
                <div className="form-group">
                  <label>Product ID</label>
                  <input
                    placeholder="Enter Product ID"
                    value={searchProductId}
                    onChange={(e) => setSearchProductId(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row" style={{ marginBottom: "12px" }}>
                <button className="btn-outline" onClick={handleFetchProduct}>
                  Fetch
                </button>
              </div>
              {fetchError && <div className="status-banner status-error">{fetchError}</div>}
              {fetchedProduct && (
                <div className="manufacturer-product-card">
                  <div className="manufacturer-product-media">
                    <img src={fetchedProduct.image || "/mob.jpg"} alt={fetchedProduct.name || "Product"} />
                  </div>
                  <div className="manufacturer-product-body">
                    <h3>{fetchedProduct.name || "Unnamed Product"}</h3>
                    <div className="manufacturer-product-grid">
                      <div><strong>Product ID:</strong> {fetchedProduct.productId || "-"}</div>
                      <div><strong>Batch ID:</strong> {fetchedProduct.batchNumber || "-"}</div>
                      <div><strong>Box ID:</strong> {fetchedProduct.boxId || "-"}</div>
                      <div><strong>Manufacturer:</strong> {fetchedProduct.manufacturer || "-"}</div>
                      <div><strong>Model Number:</strong> {fetchedProduct.modelNumber || "-"}</div>
                      <div><strong>Serial Number:</strong> {fetchedProduct.serialNumber || "-"}</div>
                      <div><strong>Warranty:</strong> {fetchedProduct.warrantyPeriod || "-"}</div>
                      <div><strong>Price:</strong> {fetchedProduct.price || "-"}</div>
                    </div>
                    <div className="manufacturer-status-row">
                      <span className={`status-banner ${fetchedProduct.shipped ? "status-success" : "status-warning"}`}>Shipped: {fetchedProduct.shipped ? "Yes" : "No"}</span>
                      <span className={`status-banner ${fetchedProduct.verifiedByRetailer ? "status-success" : "status-warning"}`}>Verified: {fetchedProduct.verifiedByRetailer ? "Yes" : "No"}</span>
                      <span className={`status-banner ${fetchedProduct.sold ? "status-error" : "status-info"}`}>Sold: {fetchedProduct.sold ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ManufacturerDashboard;
