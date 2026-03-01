import React, { useEffect, useMemo, useState } from "react";
import { connectBlockchain, saleCompleteBox, shipBox, verifyBox } from "../../trustChain";
import {
  fetchAdminBatches,
  fetchAdminBoxes,
  fetchAdminManufacturers,
  fetchAdminProducts
} from "../../services/api";
import BackButton from "../../components/BackButton";
import "../../index2.css";
import "../../admin.css";

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
    page: "M4 4h16v16H4V4zm3 4h10v2H7V8zm0 4h10v2H7v-2zm0 4h6v2H7v-2z",
    analytics: "M3 19h18v2H3v-2zm2-2V9h3v8H5zm5 0V5h3v12h-3zm5 0v-6h3v6h-3z",
    money: "M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10S2 17.5 2 12 6.5 2 12 2zm-1 5v2H9v2h2v2H9v2h2v2h2v-2h2v-2h-2v-2h2V9h-2V7h-2z",
    trend: "M4 16l5-5 4 4 7-7v3h2V5h-6v2h3l-6 6-4-4-6 6z",
    funnel: "M3 5h18l-7 7v6l-4-2v-4L3 5z",
    location: "M12 2a7 7 0 017 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 017-7zm0 4a3 3 0 100 6 3 3 0 000-6z"
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
  const [activeSection, setActiveSection] = useState("overview");
  const [analyticsRange, setAnalyticsRange] = useState("week");
  const [analyticsRows, setAnalyticsRows] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectedManufacturer = useMemo(
    () => manufacturers.find((m) => String(m.id) === String(filters.manufacturerId)),
    [manufacturers, filters.manufacturerId]
  );

  const soldProducts = useMemo(
    () => analyticsRows.filter((p) => p.sold),
    [analyticsRows]
  );

  const soldRevenue = useMemo(
    () => soldProducts.reduce((sum, p) => sum + Number(p.price || 0), 0),
    [soldProducts]
  );

  const avgSellingPrice = soldProducts.length
    ? Math.round(soldRevenue / soldProducts.length)
    : 0;

  const sellThroughRate = analyticsRows.length
    ? (soldProducts.length / analyticsRows.length) * 100
    : 0;

  const shippedCount = useMemo(
    () => analyticsRows.filter((p) => p.shipped).length,
    [analyticsRows]
  );

  const verifiedCount = useMemo(
    () => analyticsRows.filter((p) => p.verified).length,
    [analyticsRows]
  );

  const shippedToSoldRate = shippedCount ? (soldProducts.length / shippedCount) * 100 : 0;
  const verifiedToSoldRate = verifiedCount ? (soldProducts.length / verifiedCount) * 100 : 0;

  const dailySales = useMemo(() => {
    const dateToCount = new Map();
    soldProducts.forEach((p) => {
      if (!p.createdAt) return;
      const d = new Date(p.createdAt);
      if (Number.isNaN(d.getTime())) return;
      const key = d.toISOString().slice(0, 10);
      dateToCount.set(key, (dateToCount.get(key) || 0) + 1);
    });

    const days = analyticsRange === "month" ? 30 : 7;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const points = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      points.push({ date: key, soldCount: dateToCount.get(key) || 0 });
    }
    return points;
  }, [soldProducts, analyticsRange]);

  const areaDistribution = useMemo(() => {
    const areaToCount = new Map();
    soldProducts.forEach((p) => {
      const area = String(p?.box?.shippingAddress || "Unknown").trim() || "Unknown";
      areaToCount.set(area, (areaToCount.get(area) || 0) + 1);
    });
    return Array.from(areaToCount.entries())
      .map(([area, soldCount]) => ({ area, soldCount }))
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, 8);
  }, [soldProducts]);

  const analyticsFunnel = useMemo(() => ([
    { label: "Registered", value: analyticsRows.length },
    { label: "Shipped", value: shippedCount },
    { label: "Verified", value: verifiedCount },
    { label: "Sold", value: soldProducts.length }
  ]), [analyticsRows.length, shippedCount, verifiedCount, soldProducts.length]);

  const trendSummary = useMemo(() => {
    const points = dailySales.map((d) => Number(d.soldCount || 0));
    const split = Math.max(1, Math.floor(points.length / 2));
    const previous = points.slice(0, split).reduce((a, b) => a + b, 0);
    const current = points.slice(split).reduce((a, b) => a + b, 0);
    const growthPct = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    return { growthPct };
  }, [dailySales]);

  const growthTone = trendSummary.growthPct >= 0 ? "up" : "down";
  const growthAbs = Math.abs(trendSummary.growthPct).toFixed(1);

  const formatMoney = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(Number(value || 0));

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

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await fetchAdminProducts({
        ...filters,
        page: 1,
        pageSize: 300
      });
      setAnalyticsRows(data.products || []);
    } catch (err) {
      setStatusMessage(err.message || "Failed to fetch analytics data");
      setAnalyticsRows([]);
    } finally {
      setAnalyticsLoading(false);
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

  useEffect(() => {
    if (activeSection !== "analytics") return;
    loadAnalytics();
  }, [activeSection, filters, analyticsRange]);

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
    <div className="admin-page">
      <BackButton to="/roles" />

      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img src="/bc1.png" alt="TrustChain" />
          <div>
            <h2>TrustChain</h2>
            <p>Admin Console</p>
          </div>
        </div>

        <button
          className={`admin-nav ${activeSection === "overview" ? "active" : ""}`}
          onClick={() => setActiveSection("overview")}
        >
          <Icon type="manufacturer" /> Manufacturer Overview
        </button>

        <button
          className={`admin-nav ${activeSection === "inventory" ? "active" : ""}`}
          onClick={() => setActiveSection("inventory")}
        >
          <Icon type="products" /> Inventory Control
        </button>

        <button
          className={`admin-nav ${activeSection === "analytics" ? "active" : ""}`}
          onClick={() => setActiveSection("analytics")}
        >
          <Icon type="analytics" /> Sales Analytics
        </button>

        <div className="admin-sidebar-foot">
          <button
            className="btn-primary"
            onClick={handleConnectWallet}
            style={{ backgroundColor: walletConnected ? "#28a745" : "#007bff" }}
          >
            {walletConnected ? "Connected" : "Connect Wallet"}
          </button>
          {walletConnected && (
            <p className="admin-wallet-note">
              Wallet: {walletAddress ? `${walletAddress.slice(0, 12)}...` : "-"}
            </p>
          )}
        </div>
      </aside>

      <main className="admin-main">
        <section className="admin-card admin-intro-card">
          <h2>
            <Icon type="heading" />
            Admin Operations Dashboard
          </h2>
          <p>Monitor every manufacturer, filter inventory quickly, and execute lifecycle actions from one place.</p>
          <div className="admin-intro-chips">
            <span>Manufacturer Insights</span>
            <span>Lifecycle Actions</span>
            <span>Live Filter Controls</span>
          </div>
        </section>

        {activeSection === "overview" && (
          <section className="admin-card">
            <h4 className="admin-section-title">
              <Icon type="manufacturer" />
              Manufacturer Overview
            </h4>
            <div className="admin-overview-summary">
              <div className="admin-overview-kpi">
                <label>Total Manufacturers</label>
                <strong>{manufacturers.length}</strong>
              </div>
              <div className="admin-overview-kpi">
                <label>Total Products</label>
                <strong>{manufacturers.reduce((sum, m) => sum + Number(m.totalProducts || 0), 0)}</strong>
              </div>
              <div className="admin-overview-kpi">
                <label>Total Boxes</label>
                <strong>{manufacturers.reduce((sum, m) => sum + Number(m.totalBoxes || 0), 0)}</strong>
              </div>
              <div className="admin-overview-kpi">
                <label>Sold Products</label>
                <strong>{manufacturers.reduce((sum, m) => sum + Number(m.soldProducts || 0), 0)}</strong>
              </div>
            </div>

            <div className="manufacturer-overview-grid admin-manufacturer-grid">
              {manufacturers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleFilterChange("manufacturerId", String(m.id))}
                  className={`manufacturer-card ${selectedManufacturer?.id === m.id ? "selected" : ""}`}
                >
                  <div className="admin-manufacturer-head">
                    <div className="manufacturer-card-email">{m.email}</div>
                    <span className="admin-manufacturer-badge">ID #{m.id}</span>
                  </div>

                  <div className="admin-manufacturer-kpis">
                    <div className="manufacturer-stat admin-manufacturer-kpi">
                      <Icon type="products" />
                      <span>{m.totalProducts} Products</span>
                    </div>
                    <div className="manufacturer-stat admin-manufacturer-kpi">
                      <Icon type="box" />
                      <span>{m.totalBoxes} Boxes</span>
                    </div>
                    <div className="manufacturer-stat admin-manufacturer-kpi">
                      <Icon type="ship" />
                      <span>{m.shippedProducts} Shipped</span>
                    </div>
                    <div className="manufacturer-stat admin-manufacturer-kpi">
                      <Icon type="verify" />
                      <span>{m.verifiedProducts} Verified</span>
                    </div>
                    <div className="manufacturer-stat admin-manufacturer-kpi">
                      <Icon type="sold" />
                      <span>{m.soldProducts} Sold</span>
                    </div>
                  </div>

                  <div className="admin-manufacturer-progress">
                    <div className="admin-progress-row">
                      <span>Ship Rate</span>
                      <strong>
                        {m.totalProducts ? Math.round((Number(m.shippedProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%
                      </strong>
                    </div>
                    <div className="admin-progress-track">
                      <i style={{ width: `${m.totalProducts ? Math.round((Number(m.shippedProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%` }} />
                    </div>

                    <div className="admin-progress-row">
                      <span>Verification Rate</span>
                      <strong>
                        {m.totalProducts ? Math.round((Number(m.verifiedProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%
                      </strong>
                    </div>
                    <div className="admin-progress-track verified">
                      <i style={{ width: `${m.totalProducts ? Math.round((Number(m.verifiedProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%` }} />
                    </div>

                    <div className="admin-progress-row">
                      <span>Sell-through</span>
                      <strong>
                        {m.totalProducts ? Math.round((Number(m.soldProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%
                      </strong>
                    </div>
                    <div className="admin-progress-track sold">
                      <i style={{ width: `${m.totalProducts ? Math.round((Number(m.soldProducts || 0) / Number(m.totalProducts || 1)) * 100) : 0}%` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {activeSection === "inventory" && (
          <section className="admin-card">
            <h4 className="admin-section-title">
              <Icon type="filter" />
              Inventory Filters and Product Inventory
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
          </section>
        )}

        {activeSection === "analytics" && (
          <section className="admin-card">
            <div className="admin-analytics-head">
              <h4 className="admin-section-title">
                <Icon type="analytics" />
                Sales Analytics
              </h4>
              <select
                className="login-input admin-analytics-range"
                value={analyticsRange}
                onChange={(e) => setAnalyticsRange(e.target.value)}
              >
                <option value="week">Latest 7 Days</option>
                <option value="month">Latest 30 Days</option>
              </select>
            </div>

            {analyticsLoading ? (
              <p className="products-loading">Loading analytics...</p>
            ) : (
              <>
                <div className="admin-analytics-kpi-grid">
                  <div className="admin-analytics-kpi">
                    <span><Icon type="money" /> Revenue</span>
                    <strong>{formatMoney(soldRevenue)}</strong>
                    <small>{soldProducts.length} sold products</small>
                  </div>
                  <div className={`admin-analytics-kpi ${growthTone}`}>
                    <span><Icon type="trend" /> Growth Trend</span>
                    <strong>{growthAbs}%</strong>
                    <small>{growthTone === "up" ? "Demand rising" : "Demand cooling"}</small>
                  </div>
                  <div className="admin-analytics-kpi">
                    <span><Icon type="funnel" /> Sell-through</span>
                    <strong>{sellThroughRate.toFixed(1)}%</strong>
                    <small>Shipped to sold: {shippedToSoldRate.toFixed(1)}%</small>
                  </div>
                  <div className="admin-analytics-kpi">
                    <span><Icon type="money" /> Avg Selling Price</span>
                    <strong>{formatMoney(avgSellingPrice)}</strong>
                    <small>Verified to sold: {verifiedToSoldRate.toFixed(1)}%</small>
                  </div>
                </div>

                <div className="admin-analytics-main-grid">
                  <div className="admin-chart-panel">
                    <h4>Demand Curve ({analyticsRange})</h4>
                    <MiniAreaChart points={dailySales} />
                  </div>

                  <div className="admin-analytics-funnel-card">
                    <h4><Icon type="funnel" /> Conversion Funnel</h4>
                    <div className="admin-analytics-funnel-list">
                      {analyticsFunnel.map((stage) => {
                        const base = Math.max(analyticsFunnel[0]?.value || 1, 1);
                        const width = `${Math.max(8, Math.round((stage.value / base) * 100))}%`;
                        return (
                          <div key={stage.label} className="admin-analytics-funnel-row">
                            <span>{stage.label}</span>
                            <div className="admin-analytics-funnel-track"><i style={{ width }} /></div>
                            <strong>{stage.value}</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="admin-area-bars">
                  <h4><Icon type="location" /> Selling Area Distribution</h4>
                  {areaDistribution.length === 0 && (
                    <p className="products-loading">No sold-product area data available.</p>
                  )}
                  {areaDistribution.map((a) => {
                    const max = Math.max(...areaDistribution.map((x) => x.soldCount), 1);
                    const width = `${Math.round((a.soldCount / max) * 100)}%`;
                    return (
                      <div key={a.area} className="admin-area-row">
                        <span>{a.area}</span>
                        <div className="admin-area-track"><i style={{ width }} /></div>
                        <strong>{a.soldCount}</strong>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {statusMessage && <div className={`status-banner status-${getStatusTone(statusMessage)} admin-status`}>{statusMessage}</div>}
      </main>
    </div>
  );
};

export default AdminDashboard;

function MiniAreaChart({ points = [] }) {
  const width = 760;
  const height = 300;
  const padding = { top: 18, right: 18, bottom: 38, left: 46 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const rawMax = Math.max(...points.map((p) => Number(p.soldCount || 0)), 1);
  const max = rawMax <= 5 ? 5 : Math.ceil(rawMax / 5) * 5;
  const stepX = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padding.left + i * stepX;
    const y = padding.top + plotHeight - ((Number(p.soldCount || 0) / max) * plotHeight);
    return { x, y, label: p.date, val: Number(p.soldCount || 0) };
  });

  const buildSmoothPath = (list) => {
    if (!list.length) return "";
    if (list.length === 1) return `M ${list[0].x} ${list[0].y}`;
    const path = [`M ${list[0].x} ${list[0].y}`];
    for (let i = 1; i < list.length; i += 1) {
      const prev = list[i - 1];
      const curr = list[i];
      const cx = (prev.x + curr.x) / 2;
      path.push(`Q ${cx} ${prev.y} ${curr.x} ${curr.y}`);
    }
    return path.join(" ");
  };

  const linePath = buildSmoothPath(coords);
  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x} ${padding.top + plotHeight} L ${coords[0].x} ${padding.top + plotHeight} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-area-chart" role="img" aria-label="Sales trend chart">
      <defs>
        <linearGradient id="adminAreaFillLite" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="adminLineStrokeLite" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      <rect
        x={padding.left}
        y={padding.top}
        width={plotWidth}
        height={plotHeight}
        rx="10"
        fill="rgba(15,23,42,.35)"
        stroke="rgba(96,165,250,.18)"
      />

      {coords.length > 1 && <path d={areaPath} fill="url(#adminAreaFillLite)" />}
      {coords.length > 1 && <path d={linePath} fill="none" stroke="url(#adminLineStrokeLite)" strokeWidth="3" strokeLinecap="round" />}

      {coords.map((c) => (
        <g key={`${c.label}-${c.val}`}>
          <circle cx={c.x} cy={c.y} r="6" fill="rgba(56,189,248,.22)" />
          <circle cx={c.x} cy={c.y} r="3.2" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.2" />
        </g>
      ))}
    </svg>
  );
}
