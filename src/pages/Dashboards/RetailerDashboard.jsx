// src/pages/Dashboards/RetailerDashboard.js
import React, { useState } from "react";
import { ethers } from "ethers";
import {
  connectBlockchain,
  getProduct,
  getProductIdsByBox,
  verifyBox,
  saleComplete
} from "../../trustChain"; // adjust relative path if your trustChain is elsewhere
import "../../index2.css";

/*
 RetailerDashboard
 - Path: src/pages/Dashboards/RetailerDashboard.js
 - Features:
   * Connect wallet
   * Search a boxId -> shows product count + names
   * Verify box -> marks all products verified (calls verifyRetailer)
   * Scan product: paste scanned dynamic code -> verifies using product.specs.sealSeed
   * Mark product as sold (seal broken) -> calls saleComplete
   * Premium UI that uses your index2.css. Image uses objectFit:'contain' so it's NOT zoomed.
 Notes:
  - Dynamic seal scheme: keccak256( toUtf8Bytes(`${productId}|${seed}|${windowNumber}`) )
  - Checks windows [-1, 0, +1] where window is Math.floor(Date.now()/(windowSeconds*1000))
  - Manufacturer must provide `specs.sealSeed` in product.specs (or adapt to your secret scheme)
*/

const RetailerDashboard = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState("");
  const [boxId, setBoxId] = useState("");
  const [boxProducts, setBoxProducts] = useState([]); // minimal info: { productId, name }
  const [isVerifyingBox, setIsVerifyingBox] = useState(false);

  const [scanProductId, setScanProductId] = useState("");
  const [scannedCode, setScannedCode] = useState("");
  const [scanResult, setScanResult] = useState(null); // { ok, message, product }
  const [isVerifyingSeal, setIsVerifyingSeal] = useState(false);

  // Helper: connect wallet
  const handleConnect = async () => {
    try {
      const address = await connectBlockchain();
      setWalletConnected(true);
      setWalletAddress(address || "");
      setStatus(`Wallet connected: ${address || "-"}`);
    } catch (e) {
      console.error(e);
      setWalletConnected(false);
      setWalletAddress("");
      setStatus("Connect failed: " + (e?.message || e));
    }
  };

  // Fetch product IDs for a box and then fetch minimal product info (name + id)
  const handleFetchBox = async () => {
    setStatus("");
    setBoxProducts([]);
    try {
      if (!boxId || boxId.trim() === "") {
        setStatus("Enter a Box ID first.");
        return;
      }

      const ids = await getProductIdsByBox(boxId.trim());
      const fetched = [];
      for (const id of ids) {
        try {
          const p = await getProduct(id);
          fetched.push({
            productId: p.productId || id,
            name: p.name || "(no name)"
          });
        } catch {
          // partial fallback
          fetched.push({ productId: id, name: "(error fetching name)" });
        }
      }
      setBoxProducts(fetched);
      setStatus(`Box ${boxId.trim()} — ${fetched.length} product(s) found.`);
    } catch (e) {
      console.error(e);
      setStatus("Fetch box failed: " + (e?.message || e));
      setBoxProducts([]);
    }
  };

  // Verify all products in the currently loaded box
  const handleVerifyBox = async () => {
    if (!walletConnected) {
      setStatus("Connect wallet first before verifying box.");
      return;
    }
    if (!boxProducts || boxProducts.length === 0) {
      setStatus("No products loaded for this box. Click Search Box first.");
      return;
    }

    setIsVerifyingBox(true);
    setStatus("");
    try {
      await verifyBox(boxId);
      setStatus(`All ${boxProducts.length} product(s) verified for box ${boxId}.`);
      // re-fetch to update statuses if desired (we only fetched minimal info for box)
    } catch (e) {
      console.error(e);
      setStatus("Verify box failed: " + (e?.message || e));
    } finally {
      setIsVerifyingBox(false);
    }
  };

  // Compute expected keccak256-based dynamic seal for (productId, seed, window)
  const computeExpectedSeal = (productId, seed, windowNumber) => {
    const bytes = ethers.toUtf8Bytes(`${productId}|${seed}|${windowNumber}`);
    return ethers.keccak256(bytes); // 0x...
  };

  // Verify scanned code for a product using seed inside product.specs.sealSeed
  const handleVerifySeal = async () => {
    setScanResult(null);
    setStatus("");
    setIsVerifyingSeal(true);

    try {
      const pid = (scanProductId || "").trim();
      if (!pid) {
        setStatus("Enter Product ID to verify.");
        setIsVerifyingSeal(false);
        return;
      }
      const p = await getProduct(pid);
      if (!p || !p.productId) {
        setStatus("Product not found on chain.");
        setIsVerifyingSeal(false);
        return;
      }

      // seed should be present in specs
      const seed = p.specs && p.specs.sealSeed ? p.specs.sealSeed : null;
      if (!seed) {
        setStatus("No sealSeed present in product specs — cannot verify dynamic seal.");
        setIsVerifyingSeal(false);
        return;
      }

      const provided = (scannedCode || "").trim();
      if (!provided) {
        setStatus("Paste the scanned dynamic code (from NFC/QR).");
        setIsVerifyingSeal(false);
        return;
      }

      const normalizedProvided = provided.startsWith("0x") ? provided.toLowerCase() : provided;

      const windowSeconds = 60; // 60s window
      const nowWindow = Math.floor(Date.now() / (windowSeconds * 1000));

      let matched = false;
      let matchedWindow = null;
      for (let offset = -1; offset <= 1; offset++) {
        const w = nowWindow + offset;
        const expected = computeExpectedSeal(p.productId, seed, w);
        if (expected.toLowerCase() === normalizedProvided.toLowerCase()) {
          matched = true;
          matchedWindow = w;
          break;
        }
      }

      if (matched) {
        setScanResult({
          ok: true,
          message: `Dynamic seal valid (matched window ${matchedWindow}).`,
          product: p
        });
        setStatus("");
      } else {
        setScanResult({
          ok: false,
          message: "Scanned code mismatch — seal invalid or out-of-sync.",
          product: p
        });
        setStatus("");
      }
    } catch (e) {
      console.error(e);
      setStatus("Seal verification failed: " + (e?.message || e));
    } finally {
      setIsVerifyingSeal(false);
    }
  };

  // Mark product as sold (calls saleComplete)
  const handleMarkSold = async (productIdToSell) => {
    if (!walletConnected) {
      setStatus("Connect wallet first before marking sold.");
      return;
    }
    try {
      setStatus("Marking product sold...");
      await saleComplete(productIdToSell);
      setStatus("Product marked as SOLD on-chain.");
      // refresh scanned product details if currently displayed
      if (scanResult && scanResult.product && scanResult.product.productId === productIdToSell) {
        const p = await getProduct(productIdToSell);
        setScanResult({ ...scanResult, product: p });
      }
    } catch (e) {
      console.error(e);
      setStatus("Mark sold failed: " + (e?.message || e));
    }
  };

  // UI
  return (
    <div className="premium-dashboard" style={{ width: "100vw", padding: "20px" }}>
      <h2 style={{ marginTop: 0, marginBottom: 18 }}>Retailer Dashboard</h2>

      {/* Wallet connect */}
      <div className="center" style={{ marginBottom: "20px" }}>
        <button
          className="btn-primary"
          onClick={handleConnect}
          style={{
            backgroundColor: walletConnected ? "#28a745" : "#007bff",
            minWidth: 140
          }}
        >
          {walletConnected ? "Connected" : "Connect Wallet"}
        </button>
        {walletConnected && (
          <div style={{ marginTop: 8, color: "#9bd4ff", fontSize: 13 }}>
            Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
          </div>
        )}
      </div>

      {/* Box section */}
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: "#ffffff", marginBottom: 18, paddingTop: 12 }}>Box Arrival — Scan & Verify</h3>
        <div className="form-row" style={{ alignItems: "flex-end", gap: 0, marginBottom: 10 }}>
          <div className="form-group" style={{ minWidth: 260, marginRight: 8 }}>
            <label style={{ fontWeight: 500, marginBottom: 0, display: "block" }}>Box ID</label>
            <input
              className="login-input"
              placeholder="Enter / scan Box ID (e.g. BOX123456)"
              value={boxId}
              onChange={(e) => setBoxId(e.target.value)}
              style={{ width: 280, marginTop: 5 }}
            />
          </div>
          <button
            className="btn-outline"
            onClick={handleFetchBox}
            style={{ minWidth: 120, marginLeft: 8, marginBottom: 0, alignSelf: "flex-end" }}
          >
            Search Box
          </button>
          <button
            className="btn-primary"
            onClick={handleVerifyBox}
            disabled={boxProducts.length === 0 || isVerifyingBox}
            style={{
              backgroundColor: "#28a745",
              color: "#fff",
              minWidth: 160,
              marginLeft: 8,
              marginBottom: 0,
              alignSelf: "flex-end"
            }}
          >
            {isVerifyingBox ? "Verifying..." : `Verify Box (${boxProducts.length})`}
          </button>
        </div>

        {boxProducts.length > 0 && (
          <div className="fetched-product-card" style={{ marginTop: 12, padding: 16, display: "block" }}>
            <strong>Box {boxId} — {boxProducts.length} product(s)</strong>
            <ul style={{ marginTop: 8, marginBottom: 0, paddingLeft: 18 }}>
              {boxProducts.map(p => (
                <li key={p.productId} style={{ marginBottom: 2, }}>
                  <strong>{p.name}</strong> — <em>{p.productId}</em>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section style={{ marginBottom: 32 }}>
        <h3 style={{ color: "#ffffff", marginBottom: 12 }}>Product Authenticity (Inner Seal)</h3>
        <div className="form-row" style={{ alignItems: "flex-end", gap: 18, marginBottom: 10 }}>
          <div className="form-group" style={{ minWidth: 220 }}>
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Product ID</label>
            <input
              className="login-input"
              placeholder="Enter Product ID (e.g. P123456)"
              value={scanProductId}
              onChange={(e) => setScanProductId(e.target.value)}
              style={{ width: 220 }}
            />
          </div>
          <div className="form-group" style={{ minWidth: 320 }}>
            <label style={{ fontWeight: 500, marginBottom: 4 }}>Dynamic Code</label>
            <input
              className="login-input"
              placeholder="Paste scanned dynamic code (0x... from NFC/QR)"
              value={scannedCode}
              onChange={(e) => setScannedCode(e.target.value)}
              style={{ width: 320 }}
            />
          </div>
          <button
            className="btn-outline"
            onClick={handleVerifySeal}
            disabled={isVerifyingSeal}
            style={{ minWidth: 120 }}
          >
            {isVerifyingSeal ? "Checking..." : "Verify Seal"}
          </button>
        </div>

        {/* Scan result / product preview */}
        {scanResult && (
          <div
            className="fetched-product-card premium"
            style={{
              display: "flex",
              padding: 24,
              gap: 28,
              marginTop: 18,
              alignItems: "flex-start"
            }}
          >
            <div
              className="fetched-image"
              style={{
                flex: "0 0 240px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {scanResult.product && scanResult.product.image ? (
                <img
                  src={scanResult.product.image}
                  alt={scanResult.product.name}
                  style={{
                    width: 220,
                    height: 220,
                    objectFit: "contain",
                    borderRadius: 10,
                    boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
                    background: "#0b0c10"
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 220,
                    height: 140,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#0b0c10",
                    borderRadius: 8
                  }}
                >
                  <span style={{ color: "#999" }}>No image</span>
                </div>
              )}
            </div>

            <div className="fetched-details" style={{ flex: 1 }}>
              <h3 style={{ marginTop: 0, marginBottom: 10 }}>{scanResult.product?.name || "(product)"}</h3>
              <div
                className="details-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: 10,
                  marginBottom: 10
                }}
              >
                <div>
                  <label style={{ fontWeight: 500 }}>Product ID:</label>
                  <div>{scanResult.product?.productId}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 500 }}>Box ID:</label>
                  <div>{scanResult.product?.boxId}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 500 }}>Manufacturer:</label>
                  <div>{scanResult.product?.manufacturer}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 500 }}>Model:</label>
                  <div>{scanResult.product?.modelNumber}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 500 }}>Serial:</label>
                  <div>{scanResult.product?.serialNumber}</div>
                </div>
                <div>
                  <label style={{ fontWeight: 500 }}>Price:</label>
                  <div>₹{scanResult.product?.price}</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <label style={{ fontWeight: 600 }}>Seal Check:</label>
                <div style={{ marginTop: 8 }}>
                  {scanResult.ok ? (
                    <div style={{ color: "#2ecc71", fontWeight: 700 }}>
                      ✔ Authentic — dynamic seal matches
                      <div style={{ color: "#a9dcbf", fontWeight: 500 }}>{scanResult.message}</div>
                    </div>
                  ) : (
                    <div style={{ color: "#e74c3c", fontWeight: 700 }}>
                      ✖ Not authentic — scanned code mismatch
                      <div style={{ color: "#f2c6c6", fontWeight: 500 }}>{scanResult.message}</div>
                    </div>
                  )}
                </div>

                {scanResult.ok && (
                  <div style={{ marginTop: 18 }}>
                    <button
                      className="btn-primary"
                      style={{
                        backgroundColor: "#e74c3c",
                        color: "#fff",
                        minWidth: 180
                      }}
                      onClick={() => handleMarkSold(scanResult.product.productId)}
                    >
                      Mark as Sold (seal broken)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Status / error box */}
      {status && (
        <div style={{ marginTop: 8 }}>
          <div
            className="login-error"
            style={{
              background: "#071218",
              color: "#ffdede",
              padding: 10,
              borderRadius: 6,
              marginBottom: 0
            }}
          >
            {status}
          </div>
        </div>
      )}
    </div>
  );
};

export default RetailerDashboard;
