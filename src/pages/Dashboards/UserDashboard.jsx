// src/components/UserDashboard.jsx

import { useState } from "react";
import { scanNfcTag } from "../../nfc/nfcScanner.js";
import { requestChallenge,verifyResponse } from "../../services/api.js";
import "../../index2.css";

const UserDashboard = () => {
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [productId, setProductId] = useState(""); // Add productId state
  const searchProductId = productId.trim();

  const getStatusTone = (message) => {
    const text = String(message || "").toLowerCase();
    if (!text) return "info";
    if (text.includes("❌") || text.includes("fake") || text.includes("failed")) return "error";
    if (text.includes("❗") || text.includes("please")) return "warning";
    if (text.includes("🔄") || text.includes("📡") || text.includes("🔐")) return "info";
    if (text.includes("✅") || text.includes("genuine")) return "success";
    return "info";
  };
  
// ---------- Scan NFC & Verify ----------
const handleScanAndVerify = async () => {
  if (!searchProductId) {
    setStatus("❗ Please enter a Product ID.");
    return;
  }

  try {
    setScanning(true);
    setStatus("🔄 Requesting challenge...");

    // 1️⃣ Request challenge
    const { challenge } = await requestChallenge(searchProductId);

    console.log("FRONTEND DEBUG:");
    console.log("Product ID:", searchProductId);
    console.log("Challenge:", challenge);

    // 2️⃣ NFC signs challenge
    setStatus("📡 Signing challenge via NFC...");
    const response = await scanNfcTag(searchProductId, challenge);

    console.log("Response:", response);

    // 3️⃣ Verify with backend
    setStatus("🔐 Verifying product...");
    const result = await verifyResponse(searchProductId, response);

    if (result.status === "GENUINE") {
      setStatus("✅ Genuine Product");
      setProduct(result.product);
    } else {
      setStatus("❌ Fake Product");
      setProduct(null);
    }

  } catch (err) {
    console.error("Verification error:", err);
    setStatus("❌ Verification failed");
    setProduct(null);
  } finally {
    setScanning(false);
  }
};


  return (
    <div className="premium-dashboard" style={{ width: "100vw", padding: "20px" }}>
      <h2>Product Verification Portal</h2>

      {/* ================= SCAN NFC ================= */}
      <div className="product-form">
        <input
          type="text"
          placeholder="Enter Product ID"
          value={productId}
          onChange={e => setProductId(e.target.value)}
          style={{ marginBottom: "10px", padding: "8px", width: "250px" }}
        />
        <button
          className="btn-outline"
          onClick={handleScanAndVerify}
          disabled={scanning}
          style={{ marginBottom: "15px", marginLeft: "10px" }}
        >
          {scanning ? "Scanning NFC..." : "Scan NFC"}
        </button>

        {status && <div className={`status-banner status-${getStatusTone(status)}`}>{status}</div>}

        {/* ================= PRODUCT CARD ================= */}
        {product && (
          <div
            className="fetched-product-card premium"
            style={{
              display: "flex",
              padding: "25px",
              gap: "25px",
              width: "95%",
              marginTop: "20px",
              alignItems: "flex-start"
            }}
          >
            {/* ---------- IMAGE ---------- */}
            <div className="fetched-image">
              <img
                src={product.image}
                alt={product.name}
                className="product-preview"
                style={{
                  width: "350px",
                  height: "350px",
                  objectFit: "cover",
                  borderRadius: "12px",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.25)"
                }}
              />
            </div>

            {/* ---------- DETAILS ---------- */}
            <div className="fetched-details" style={{ flex: 1 }}>
              <h3>{product.name}</h3>
              <div className="status-banner status-success" style={{ marginTop: 8, display: "inline-block" }}>
                Authenticity: Genuine Product
              </div>

              <div
                className="details-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
                  gap: "12px",
                  marginTop: "12px"
                }}
              >
                <div><strong>Product ID:</strong> {product.productId}</div>
                <div><strong>Manufacturer:</strong> {product.manufacturer}</div>
                <div><strong>Model Number:</strong> {product.modelNumber || "-"}</div>
                <div><strong>Batch Number:</strong> {product.batchNumber || "-"}</div>
                <div><strong>Serial Number:</strong> {product.serialNumber || "-"}</div>
                <div><strong>Price:</strong> ₹{product.price || "-"}</div>
              </div>

              {/* ---------- STATUS ---------- */}
              <div
                className="status-icons"
                style={{
                  marginTop: "20px",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap"
                }}
              >
                <span className={`status-banner ${product.shipped ? "status-success" : "status-warning"}`} style={{ marginTop: 0, padding: "6px 10px" }}>
                  Shipped: {product.shipped ? "Yes" : "No"}
                </span>
                <span className={`status-banner ${product.verifiedByRetailer ? "status-success" : "status-warning"}`} style={{ marginTop: 0, padding: "6px 10px" }}>
                  Verified: {product.verifiedByRetailer ? "Yes" : "No"}
                </span>
                <span className={`status-banner ${product.sold ? "status-error" : "status-info"}`} style={{ marginTop: 0, padding: "6px 10px" }}>
                  Sold: {product.sold ? "Yes" : "No"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDashboard;
