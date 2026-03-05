import React, { useCallback, useEffect, useState } from "react";
import {
  connectBlockchain,
  getProduct,
  getProductIdsByBox,
  verifyBox,
  saleComplete
} from "../../trustChain";
import BackButton from "../../components/BackButton";
import "../../index2.css";
import "../../retailer.css";
import { fetchBoxRetailerAssignment, fetchRetailerAnalytics } from "../../services/api";

const RetailerDashboard = () => {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [status, setStatus] = useState("");
  const [activeSection, setActiveSection] = useState("box");

  const [boxId, setBoxId] = useState("");
  const [boxProducts, setBoxProducts] = useState([]);
  const [isVerifyingBox, setIsVerifyingBox] = useState(false);

  const [scanProductId, setScanProductId] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [isVerifyingProduct, setIsVerifyingProduct] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const isBoxAlreadyVerified =
    boxProducts.length > 0 &&
    boxProducts.every((p) => p.verifiedByRetailer || p.sold);

  const getStatusTone = (message) => {
    const text = String(message || "").toLowerCase();
    if (!text) return "info";
    if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found") || text.includes("mismatch")) return "error";
    if (text.includes("⚠") || text.includes("required") || text.includes("cannot") || text.includes("already sold")) return "warning";
    if (text.includes("⏳") || text.includes("checking") || text.includes("marking") || text.includes("verifying")) return "info";
    if (text.includes("✅") || text.includes("connected") || text.includes("valid") || text.includes("found")) return "success";
    return "info";
  };

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

  const handleFetchBox = async () => {
    setStatus("");
    setBoxProducts([]);
    try {
      if (!boxId || boxId.trim() === "") {
        setStatus("Enter a Box ID first.");
        return;
      }

      const assignment = await fetchBoxRetailerAssignment(boxId.trim());
      if (!assignment.assignedToCurrent) {
        const recipient = assignment.retailerEmail || "another retailer";
        setStatus(`Box ${boxId.trim()} is assigned to ${recipient}.`);
        setBoxProducts([]);
        return;
      }

      const ids = await getProductIdsByBox(boxId.trim());
      const fetched = [];
      for (const id of ids) {
        try {
          const p = await getProduct(id);
          fetched.push({
            productId: p.productId || id,
            name: p.name || "(no name)",
            verifiedByRetailer: !!p.verifiedByRetailer,
            sold: !!p.sold
          });
        } catch {
          fetched.push({
            productId: id,
            name: "(error fetching name)",
            verifiedByRetailer: false,
            sold: false
          });
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

  const handleVerifyBox = async () => {
    if (!walletConnected) {
      setStatus("Connect wallet first before verifying box.");
      return;
    }
    if (!boxProducts || boxProducts.length === 0) {
      setStatus("No products loaded for this box. Click Search Box first.");
      return;
    }
    if (isBoxAlreadyVerified) {
      setStatus(`Box ${boxId.trim()} is already verified.`);
      return;
    }

    setIsVerifyingBox(true);
    setStatus("");
    try {
      const bid = boxId.trim();
      await verifyBox(bid);

      // Refresh product statuses immediately so UI updates without manual refresh.
      const ids = await getProductIdsByBox(bid);
      const refreshed = [];
      for (const id of ids) {
        try {
          const p = await getProduct(id);
          refreshed.push({
            productId: p.productId || id,
            name: p.name || "(no name)",
            verifiedByRetailer: !!p.verifiedByRetailer,
            sold: !!p.sold
          });
        } catch {
          refreshed.push({
            productId: id,
            name: "(error fetching name)",
            verifiedByRetailer: false,
            sold: false
          });
        }
      }
      setBoxProducts(refreshed);
      setStatus(`All ${refreshed.length} product(s) verified for box ${bid}.`);
    } catch (e) {
      console.error(e);
      setStatus("Verify box failed: " + (e?.message || e));
    } finally {
      setIsVerifyingBox(false);
    }
  };

  const handleVerifyProduct = async () => {
    setScanResult(null);
    setStatus("");
    setIsVerifyingProduct(true);

    try {
      const pid = (scanProductId || "").trim();
      if (!pid) {
        setStatus("Enter Product ID to verify.");
        setIsVerifyingProduct(false);
        return;
      }
      const p = await getProduct(pid);
      if (!p || !p.productId) {
        setStatus("Product not found on chain.");
        setIsVerifyingProduct(false);
        return;
      }

      setScanResult({
        ok: true,
        message: "Product exists on blockchain and is genuine.",
        product: p
      });
      setStatus("✅ Genuine product found.");
    } catch (e) {
      console.error(e);
      setStatus("Product verification failed: " + (e?.message || e));
    } finally {
      setIsVerifyingProduct(false);
    }
  };

  const handleMarkSold = async (productIdToSell) => {
    if (!walletConnected) {
      setStatus("Connect wallet first before marking sold.");
      return;
    }
    try {
      setStatus("Marking product sold...");
      await saleComplete(productIdToSell);
      setStatus("Product marked as SOLD on-chain.");
      if (scanResult && scanResult.product && scanResult.product.productId === productIdToSell) {
        const p = await getProduct(productIdToSell);
        setScanResult({ ...scanResult, product: p });
      }
    } catch (e) {
      console.error(e);
      setStatus("Mark sold failed: " + (e?.message || e));
    }
  };

  const loadAnalytics = useCallback(async () => {
    setAnalyticsError("");
    setAnalyticsLoading(true);
    try {
      const data = await fetchRetailerAnalytics();
      setAnalyticsData(data);
    } catch (err) {
      console.error("Retailer analytics load failed:", err);
      setAnalyticsError(err.message || "Failed to load retailer analytics");
      setAnalyticsData(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "analytics") {
      loadAnalytics();
    }
  }, [activeSection, loadAnalytics]);

  const summary = analyticsData?.summary || null;
  const areaDistribution = analyticsData?.areaDistribution || [];
  const recentBoxesList = analyticsData?.recentBoxes || [];
  const areaMaxCount = areaDistribution.reduce((max, entry) => Math.max(max, entry.boxCount), 0) || 1;
  const totalProducts = summary?.totalProducts || 0;
  const verifiedPercent = totalProducts ? ((summary.verifiedProducts / totalProducts) * 100).toFixed(1) : "0.0";
  const soldPercent = totalProducts ? ((summary.soldProducts / totalProducts) * 100).toFixed(1) : "0.0";

  return (
    <div className="retailer-page">
      <BackButton to="/roles" />
      <aside className="retailer-sidebar">
        <div className="retailer-brand">
          <img src="/bc1.png" alt="TrustChain" />
          <div>
            <h2>TrustChain</h2>
            <p>Retailer Console</p>
          </div>
        </div>

        <button
          className={`retailer-nav ${activeSection === "box" ? "active" : ""}`}
          onClick={() => setActiveSection("box")}
        >
          Verify Box
        </button>
        <button
          className={`retailer-nav ${activeSection === "product" ? "active" : ""}`}
          onClick={() => setActiveSection("product")}
        >
          Product Authenticity
        </button>
        <button
          className={`retailer-nav ${activeSection === "analytics" ? "active" : ""}`}
          onClick={() => setActiveSection("analytics")}
        >
          Analytics
        </button>

        <div className="retailer-sidebar-foot">
          <button
            className="btn-primary"
            onClick={handleConnect}
            style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
          >
            {walletConnected ? "Connected" : "Connect Wallet"}
          </button>
          {walletConnected && (
            <p className="retailer-wallet-note">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
            </p>
          )}
        </div>
      </aside>

      <main className="retailer-main">
        {activeSection === "box" && (
          <section className="retailer-card">
            <h2>Box Arrival - Scan & Verify</h2>
            <div className="retailer-search-row">
              <input
                className="retailer-input"
                placeholder="Enter / scan Box ID (e.g. BOX123456)"
                value={boxId}
                onChange={(e) => setBoxId(e.target.value)}
              />
              <button className="btn-outline" onClick={handleFetchBox}>
                Search Box
              </button>
              <button
                className="btn-primary"
                onClick={handleVerifyBox}
                disabled={boxProducts.length === 0 || isVerifyingBox || isBoxAlreadyVerified}
              >
                {isVerifyingBox
                  ? "Verifying..."
                  : isBoxAlreadyVerified
                    ? "Already Verified"
                    : `Verify Box (${boxProducts.length})`}
              </button>
            </div>

            {boxProducts.length > 0 && (
              <div className="retailer-list-card">
                <div className="retailer-list-head">
                  <strong>Box {boxId}</strong>
                  <span>{boxProducts.length} product(s)</span>
                </div>
                <ul>
                  {boxProducts.map((p) => (
                    <li key={p.productId}>
                      <div className="retailer-list-text">
                        <span>{p.name}</span>
                        <em>{p.productId}</em>
                      </div>
                      <div className="retailer-list-statuses">
                        <span className={`retailer-pill ${p.sold ? "sold" : p.verifiedByRetailer ? "ok" : "pending"}`}>
                          {p.sold ? "Sold" : p.verifiedByRetailer ? "Verified" : "Pending"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {activeSection === "product" && (
          <section className="retailer-card">
            <h2>Product Authenticity</h2>
            <div className="retailer-search-row">
              <input
                className="retailer-input"
                placeholder="Enter Product ID (e.g. P123456)"
                value={scanProductId}
                onChange={(e) => setScanProductId(e.target.value)}
              />
              <button className="btn-outline" onClick={handleVerifyProduct} disabled={isVerifyingProduct}>
                {isVerifyingProduct ? "Verifying..." : "Verify Product"}
              </button>
            </div>

            {scanResult && (
              <div className="retailer-product-card">
                <div className="retailer-product-media">
                  {scanResult.product?.image ? (
                    <img src={scanResult.product.image} alt={scanResult.product.name} />
                  ) : (
                    <div className="retailer-no-image">No image</div>
                  )}
                </div>

                <div className="retailer-product-body">
                  <h3>{scanResult.product?.name || "(product)"}</h3>
                  <div className="retailer-product-grid">
                    <div><strong>Product ID:</strong> {scanResult.product?.productId}</div>
                    <div><strong>Box ID:</strong> {scanResult.product?.boxId}</div>
                    <div><strong>Manufacturer:</strong> {scanResult.product?.manufacturer}</div>
                    <div><strong>Model:</strong> {scanResult.product?.modelNumber}</div>
                    <div><strong>Serial:</strong> {scanResult.product?.serialNumber}</div>
                    <div><strong>Price:</strong> ₹{scanResult.product?.price}</div>
                  </div>

                  <div className="retailer-status-row">
                    <span className={`status-banner ${scanResult.product?.shipped ? "status-success" : "status-warning"}`}>
                      Shipped: {scanResult.product?.shipped ? "Yes" : "No"}
                    </span>
                    <span className={`status-banner ${scanResult.product?.verifiedByRetailer ? "status-success" : "status-warning"}`}>
                      Verified: {scanResult.product?.verifiedByRetailer ? "Yes" : "No"}
                    </span>
                    <span className={`status-banner ${scanResult.product?.sold ? "status-error" : "status-info"}`}>
                      Sold: {scanResult.product?.sold ? "Yes" : "No"}
                    </span>
                  </div>

                  <div className="retailer-auth-check">
                    {scanResult.ok ? (
                      <div className="retailer-ok">✔ Genuine Product</div>
                    ) : (
                      <div className="retailer-bad">✖ Not authentic</div>
                    )}
                    <small>{scanResult.message}</small>
                  </div>

                  {scanResult.ok && !scanResult.product?.sold && scanResult.product?.shipped && scanResult.product?.verifiedByRetailer && (
                    <button className="btn-primary retailer-sold-btn" onClick={() => handleMarkSold(scanResult.product.productId)}>
                      Mark as Sold (seal broken)
                    </button>
                  )}

                  {scanResult.ok && scanResult.product?.sold && (
                    <div className="status-banner status-warning retailer-inline-note">
                      This product is already sold.
                    </div>
                  )}

                  {scanResult.ok && !scanResult.product?.sold && (!scanResult.product?.shipped || !scanResult.product?.verifiedByRetailer) && (
                    <div className="status-banner status-warning retailer-inline-note">
                      Product can be sold only after shipping and retailer verification.
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {activeSection === "analytics" && (
          <section className="retailer-card retailer-analytics-card">
            <h2>Operational Analytics</h2>
            {analyticsLoading ? (
              <p className="products-loading">Loading analytics overview...</p>
            ) : analyticsError ? (
              <div className="status-banner status-error">{analyticsError}</div>
            ) : summary ? (
              <>
                <div className="retailer-analytics-grid">
                  <article className="retailer-analytics-kpi">
                    <span>Assigned Boxes</span>
                    <strong>{summary.totalBoxes}</strong>
                    <small>Boxes shipped to you</small>
                  </article>
                  <article className="retailer-analytics-kpi">
                    <span>Products On-Chain</span>
                    <strong>{summary.totalProducts}</strong>
                    <small>{totalProducts ? `${totalProducts} recorded items` : "No products yet"}</small>
                  </article>
                  <article className="retailer-analytics-kpi verified">
                    <span>Verified</span>
                    <strong>
                      {summary.verifiedProducts} ({verifiedPercent}%)
                    </strong>
                    <small>Retailer-verified</small>
                  </article>
                  <article className="retailer-analytics-kpi sold">
                    <span>Sold</span>
                    <strong>
                      {summary.soldProducts} ({soldPercent}%)
                    </strong>
                    <small>Haul sealed as sold</small>
                  </article>
                </div>

                <div className="retailer-area-bars">
                  <h4>Top Shipping Areas</h4>
                  {areaDistribution.length === 0 ? (
                    <p className="products-loading">No shipping data yet.</p>
                  ) : (
                    areaDistribution.map((area) => {
                      const width = Math.max(8, Math.round((area.boxCount / areaMaxCount) * 100));
                      return (
                        <div key={area.area} className="retailer-area-row">
                          <span>{area.area}</span>
                          <div className="retailer-area-track">
                            <i style={{ width: `${width}%` }} />
                          </div>
                          <strong>{area.boxCount}</strong>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="retailer-recent-boxes">
                  <h4>Recent Boxes</h4>
                  {recentBoxesList.length === 0 ? (
                    <p className="products-loading">No boxes assigned yet.</p>
                  ) : (
                    recentBoxesList.map((box) => (
                      <article className="retailer-recent-box" key={`${box.boxId}-${box.createdAt}`}>
                        <div className="retailer-recent-box-header">
                          <strong>Box {box.boxId}</strong>
                          <span>{box.batchId}</span>
                        </div>
                        <div className="retailer-recent-box-meta">
                          <span>{new Date(box.createdAt).toLocaleDateString()}</span>
                          <span>{box.shippingAddress}</span>
                        </div>
                        <div className="retailer-recent-box-stats">
                          <small>Products: {box.productCount}</small>
                          <small>Verified: {box.verifiedProducts}</small>
                          <small>Sold: {box.soldProducts}</small>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : (
              <p className="products-loading">No analytics data yet.</p>
            )}
          </section>
        )}

        {status && (
          <div className={`status-banner status-${getStatusTone(status)}`}>
            {status}
          </div>
        )}
      </main>
    </div>
  );
};

export default RetailerDashboard;
