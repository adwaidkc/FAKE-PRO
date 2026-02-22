import React, { useEffect, useMemo, useState } from "react";
import { connectBlockchain, saleCompleteBox, shipBox, verifyBox } from "../../trustChain";
import {
  fetchAdminBatches,
  fetchAdminBoxes,
  fetchAdminManufacturers,
  fetchAdminProducts
} from "../../services/api";
import "../../index2.css";

const PAGE_SIZE = 5;

const defaultFilters = {
  manufacturerId: "",
  batchId: "",
  boxId: "",
  status: "ALL",
  fromDate: "",
  toDate: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1
};

const Icon = ({ type }) => {
  const iconMap = {
    heading: "M3 4h18v2H3V4zm0 7h12v2H3v-2zm0 7h18v2H3v-2z",
    manufacturer: "M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 1114 0H5z",
    products: "M4 5h16v4H4V5zm0 5h10v9H4v-9zm11 2h5v7h-5v-7z",
    box: "M3 7l9-4 9 4-9 4-9-4zm2 3l7 3v8l-7-3v-8zm14 0l-7 3v8l7-3v-8z",
    status: "M12 3l8 4v5c0 5-3.4 9.5-8 10-4.6-.5-8-5-8-10V7l8-4zm-1 6v6l5-3-5-3z",
    filter: "M3 5h18l-7 8v6l-4-2v-4L3 5z",
    calendar: "M7 2h2v3H7V2zm8 0h2v3h-2V2zM4 5h16v15H4V5zm2 4v9h12V9H6z",
    sort: "M7 17h10v2H7v-2zm2-4h6v2H9v-2zm2-4h2v2h-2V9zm1-7l4 4h-3v8h-2V6H8l4-4z",
    ship: "M3 6h15v9H3V6zm15 2h2l1 2v5h-3V8zM7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z",
    verify: "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.5-1.5L9 16.2z",
    sold: "M12 2l7 4v6c0 5-3.5 9.5-7 10-3.5-.5-7-5-7-10V6l7-4zm-1 6h2v2h2v2h-2v2h-2v-2H9v-2h2V8z",
    reset: "M12 5V2L7 7l5 5V9c2.8 0 5 2.2 5 5s-2.2 5-5 5a5 5 0 01-4.8-3.7l-1.9.5A7 7 0 0012 21a7 7 0 000-14z",
    page: "M4 4h16v16H4V4zm3 4h10v2H7V8zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"
  };

  return (
    <svg viewBox="0 0 24 24" className="admin-icon" aria-hidden="true">
      <path d={iconMap[type] || iconMap.heading} />
    </svg>
  );
};

const getStatusTone = (message) => {
  const text = String(message || "").toLowerCase();
  if (!text) return "info";
  if (text.includes("❌") || text.includes("failed") || text.includes("error") || text.includes("not found")) return "error";
  if (text.includes("⚠") || text.includes("required") || text.includes("mismatch")) return "warning";
  if (text.includes("⏳") || text.includes("loading") || text.includes("verifying")) return "info";
  if (text.includes("✅") || text.includes("connected") || text.includes("synced") || text.includes("success")) return "success";
  return "info";
};

const AdminDashboard = () => {
  const [manufacturers, setManufacturers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [boxes, setBoxes] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(defaultFilters);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedManufacturer = useMemo(
    () => manufacturers.find((m) => String(m.id) === String(filters.manufacturerId)),
    [manufacturers, filters.manufacturerId]
  );

  const loadManufacturers = async () => {
    const data = await fetchAdminManufacturers();
    setManufacturers(data.manufacturers || []);
  };

  const loadBatches = async (manufacturerId) => {
    const data = await fetchAdminBatches(manufacturerId || "");
    setBatches(data.batches || []);
  };

  const loadBoxes = async (manufacturerId, batchId) => {
    const data = await fetchAdminBoxes(manufacturerId || "", batchId || "");
    setBoxes(data.boxes || []);
  };

  const loadProducts = async (activeFilters) => {
    setLoading(true);
    try {
      const payload = {
        ...activeFilters,
        pageSize: PAGE_SIZE
      };
      const data = await fetchAdminProducts(payload);
      setProducts(data.products || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadManufacturers();
        await loadBatches("");
        await loadBoxes("", "");
        await loadProducts(defaultFilters);
      } catch (err) {
        setStatusMessage(err.message || "Failed to load dashboard");
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await loadProducts(filters);
      } catch (err) {
        setStatusMessage(err.message || "Failed to fetch products");
      }
    };
    run();
  }, [filters]);

  const handleFilterChange = async (name, value) => {
    if (name === "manufacturerId") {
      setFilters((prev) => ({ ...prev, manufacturerId: value, batchId: "", boxId: "", page: 1 }));
      try {
        await Promise.all([loadBatches(value), loadBoxes(value, "")]);
      } catch (err) {
        setStatusMessage(err.message || "Failed to fetch filter options");
      }
      return;
    }

    if (name === "batchId") {
      setFilters((prev) => ({ ...prev, batchId: value, boxId: "", page: 1 }));
      try {
        await loadBoxes(filters.manufacturerId, value);
      } catch (err) {
        setStatusMessage(err.message || "Failed to fetch box options");
      }
      return;
    }

    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const resetFilters = async () => {
    setFilters(defaultFilters);
    try {
      await Promise.all([loadBatches(""), loadBoxes("", "")]);
    } catch (err) {
      setStatusMessage(err.message || "Failed to fetch filter options");
    }
  };

  const handleShip = async (row) => {
    if (!walletConnected) {
      setStatusMessage("Connect wallet first before shipping.");
      return;
    }
    const key = `ship-${row.id}`;
    setActionLoadingKey(key);
    setStatusMessage("");
    try {
      await shipBox(row.box.boxId, row.manufacturerId);
      setStatusMessage(`Box ${row.box.boxId} shipped and DB synced.`);
      await loadProducts(filters);
      await loadManufacturers();
    } catch (err) {
      setStatusMessage(`Ship failed: ${err.message}`);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleVerify = async (row) => {
    if (!walletConnected) {
      setStatusMessage("Connect wallet first before verifying.");
      return;
    }
    const key = `verify-${row.id}`;
    setActionLoadingKey(key);
    setStatusMessage("");
    try {
      await verifyBox(row.box.boxId, row.manufacturerId);
      setStatusMessage(`Box ${row.box.boxId} verified and DB synced.`);
      await loadProducts(filters);
      await loadManufacturers();
    } catch (err) {
      setStatusMessage(`Verify failed: ${err.message}`);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleMarkSold = async (row) => {
    if (!walletConnected) {
      setStatusMessage("Connect wallet first before marking sold.");
      return;
    }
    const key = `sold-${row.id}`;
    setActionLoadingKey(key);
    setStatusMessage("");
    try {
      await saleCompleteBox(row.box.boxId, row.manufacturerId);
      setStatusMessage(`Box ${row.box.boxId} marked sold and DB synced.`);
      await loadProducts(filters);
      await loadManufacturers();
    } catch (err) {
      setStatusMessage(`Mark sold failed: ${err.message}`);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectBlockchain();
      setWalletConnected(true);
      setWalletAddress(address || "");
      setStatusMessage(`Wallet connected: ${address || "-"}`);
    } catch (err) {
      setWalletConnected(false);
      setWalletAddress("");
      setStatusMessage(`Wallet connection failed: ${err.message || "Unknown error"}`);
    }
  };

  return (
    <div className="premium-dashboard admin-dashboard-shell">
      <h2 className="admin-title">
        <Icon type="heading" />
        Admin Operations Dashboard
      </h2>
      <p className="admin-subtitle">Monitor every manufacturer, filter inventory quickly, and execute lifecycle actions from one place.</p>
      <div className="center" style={{ marginBottom: 12 }}>
        <button
          className="btn-primary"
          onClick={handleConnectWallet}
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

      <div className="fetched-product-card admin-section">
        <h4 className="admin-section-title">
          <Icon type="manufacturer" />
          Manufacturer Overview
        </h4>
        <div className="manufacturer-overview-grid">
          {manufacturers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleFilterChange("manufacturerId", String(m.id))}
              className={`manufacturer-card ${selectedManufacturer?.id === m.id ? "selected" : ""}`}
            >
              <div className="manufacturer-card-email">{m.email}</div>
              <div className="manufacturer-stats-grid">
                <div className="manufacturer-stat">
                  <Icon type="products" />
                  <span>Products: {m.totalProducts}</span>
                </div>
                <div className="manufacturer-stat">
                  <Icon type="box" />
                  <span>Boxes: {m.totalBoxes}</span>
                </div>
                <div className="manufacturer-stat">
                  <Icon type="ship" />
                  <span>Shipped: {m.shippedProducts}</span>
                </div>
                <div className="manufacturer-stat">
                  <Icon type="verify" />
                  <span>Verified: {m.verifiedProducts}</span>
                </div>
                <div className="manufacturer-stat">
                  <Icon type="sold" />
                  <span>Sold: {m.soldProducts}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="fetched-product-card admin-section">
        <h4 className="admin-section-title">
          <Icon type="filter" />
          Filters and Sorting
        </h4>
        <div className="admin-filters-grid">
          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="manufacturer" />Manufacturer</label>
            <select
              className="login-input"
              value={filters.manufacturerId}
              onChange={(e) => handleFilterChange("manufacturerId", e.target.value)}
            >
              <option value="">All Manufacturers</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>{m.email}</option>
              ))}
            </select>
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="products" />Batch ID</label>
            <select
              className="login-input"
              value={filters.batchId}
              onChange={(e) => handleFilterChange("batchId", e.target.value)}
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={`${b.manufacturerId}-${b.batchId}`} value={b.batchId}>
                  {b.batchId} ({b.productCount})
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="box" />Box ID</label>
            <select
              className="login-input"
              value={filters.boxId}
              onChange={(e) => handleFilterChange("boxId", e.target.value)}
            >
              <option value="">All Boxes</option>
              {boxes.map((b) => (
                <option key={`${b.manufacturerId}-${b.boxId}`} value={b.boxId}>
                  {b.boxId} ({b.productCount})
                </option>
              ))}
            </select>
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="status" />Status</label>
            <select
              className="login-input"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="ALL">ALL</option>
              <option value="CREATED">CREATED</option>
              <option value="SHIPPED">SHIPPED</option>
              <option value="VERIFIED">VERIFIED</option>
              <option value="SOLD">SOLD</option>
            </select>
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="sort" />Sort By</label>
            <select
              className="login-input"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange("sortBy", e.target.value)}
            >
              <option value="createdAt">Created Date</option>
              <option value="batchId">Batch</option>
              <option value="manufacturer">Manufacturer</option>
              <option value="productId">Product ID</option>
              <option value="boxId">Box ID</option>
              <option value="lifecycle">Lifecycle</option>
            </select>
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="calendar" />From Date</label>
            <input
              type="date"
              className="login-input"
              value={filters.fromDate}
              onChange={(e) => handleFilterChange("fromDate", e.target.value)}
            />
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="calendar" />To Date</label>
            <input
              type="date"
              className="login-input"
              value={filters.toDate}
              onChange={(e) => handleFilterChange("toDate", e.target.value)}
            />
          </div>

          <div className="admin-filter-item">
            <label className="admin-filter-label"><Icon type="sort" />Sort Order</label>
            <select
              className="login-input"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
            >
              <option value="desc">DESC</option>
              <option value="asc">ASC</option>
            </select>
          </div>

          <div className="admin-filter-item admin-filter-actions">
            <button className="btn-outline btn-reset" onClick={resetFilters}>
              <Icon type="reset" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      <div className="fetched-product-card admin-section">
        <div className="products-header-row">
          <h4 className="admin-section-title">
            <Icon type="products" />
            Product Inventory ({total})
          </h4>
          <div className="products-header-note">
            <Icon type="sort" />
            Sorting is applied immediately from the Sort By and Sort Order fields.
          </div>
        </div>

        {loading ? (
          <p className="products-loading">Loading products...</p>
        ) : (
          <div className="admin-products-table-wrap">
            <table className="admin-products-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Manufacturer</th>
                  <th>Box</th>
                  <th>Shipping Address</th>
                  <th>Batch</th>
                  <th>Lifecycle</th>
                  <th>Shipped</th>
                  <th>Verified</th>
                  <th>Sold</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.productId}</td>
                    <td>{p.manufacturer?.email || "-"}</td>
                    <td>{p.box?.boxId || "-"}</td>
                    <td>{p.box?.shippingAddress || "-"}</td>
                    <td>{p.batchId}</td>
                    <td><span className="lifecycle-pill">{p.lifecycle}</span></td>
                    <td>{p.shipped ? "Yes" : "No"}</td>
                    <td>{p.verified ? "Yes" : "No"}</td>
                    <td>{p.sold ? "Yes" : "No"}</td>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="btn-action btn-ship"
                          onClick={() => handleShip(p)}
                          disabled={actionLoadingKey === `ship-${p.id}`}
                        >
                          <Icon type="ship" />
                          Ship Box
                        </button>
                        <button
                          className="btn-action btn-verify"
                          onClick={() => handleVerify(p)}
                          disabled={actionLoadingKey === `verify-${p.id}`}
                        >
                          <Icon type="verify" />
                          Verify
                        </button>
                        <button
                          className="btn-action btn-sold"
                          onClick={() => handleMarkSold(p)}
                          disabled={actionLoadingKey === `sold-${p.id}`}
                        >
                          <Icon type="sold" />
                          Mark Sold
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={11} className="admin-empty-row">
                      No products found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-pagination">
          <button
            className="btn-outline"
            disabled={filters.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </button>
          <span className="admin-page-indicator">
            <Icon type="page" />
            Page {filters.page} of {totalPages}
          </span>
          <button
            className="btn-outline"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {statusMessage && <div className={`status-banner status-${getStatusTone(statusMessage)} admin-status`}>{statusMessage}</div>}
    </div>
  );
};

export default AdminDashboard;
