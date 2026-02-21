import React, { useEffect, useMemo, useState } from "react";
import { saleComplete, shipBox, verifyProduct } from "../../trustChain";
import {
  fetchAdminBatches,
  fetchAdminManufacturers,
  fetchAdminProducts
} from "../../services/api";
import "../../index2.css";

const PAGE_SIZE = 10;

const defaultFilters = {
  manufacturerId: "",
  batchId: "",
  status: "ALL",
  fromDate: "",
  toDate: "",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1
};

const AdminDashboard = () => {
  const [manufacturers, setManufacturers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(defaultFilters);
  const [statusMessage, setStatusMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState("");

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
      setFilters((prev) => ({ ...prev, manufacturerId: value, batchId: "", page: 1 }));
      try {
        await loadBatches(value);
      } catch (err) {
        setStatusMessage(err.message || "Failed to fetch batch options");
      }
      return;
    }

    setFilters((prev) => ({ ...prev, [name]: value, page: 1 }));
  };

  const resetFilters = async () => {
    setFilters(defaultFilters);
    try {
      await loadBatches("");
    } catch (err) {
      setStatusMessage(err.message || "Failed to fetch batch options");
    }
  };

  const setSort = (sortBy) => {
    setFilters((prev) => {
      const isSame = prev.sortBy === sortBy;
      return {
        ...prev,
        sortBy,
        sortOrder: isSame && prev.sortOrder === "desc" ? "asc" : "desc",
        page: 1
      };
    });
  };

  const handleShip = async (row) => {
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
    const key = `verify-${row.id}`;
    setActionLoadingKey(key);
    setStatusMessage("");
    try {
      await verifyProduct(row.productId, row.manufacturerId);
      setStatusMessage(`Product ${row.productId} verified and DB synced.`);
      await loadProducts(filters);
      await loadManufacturers();
    } catch (err) {
      setStatusMessage(`Verify failed: ${err.message}`);
    } finally {
      setActionLoadingKey("");
    }
  };

  const handleMarkSold = async (row) => {
    const key = `sold-${row.id}`;
    setActionLoadingKey(key);
    setStatusMessage("");
    try {
      await saleComplete(row.productId, row.manufacturerId);
      setStatusMessage(`Product ${row.productId} marked sold and DB synced.`);
      await loadProducts(filters);
      await loadManufacturers();
    } catch (err) {
      setStatusMessage(`Mark sold failed: ${err.message}`);
    } finally {
      setActionLoadingKey("");
    }
  };

  return (
    <div className="premium-dashboard" style={{ width: "100vw", padding: 20 }}>
      <h2>Admin Operations Dashboard</h2>

      <div className="fetched-product-card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Manufacturer Overview</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(220px, 1fr))", gap: 12 }}>
          {manufacturers.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleFilterChange("manufacturerId", String(m.id))}
              style={{
                textAlign: "left",
                borderRadius: 8,
                border: selectedManufacturer?.id === m.id ? "1px solid #5eb8ff" : "1px solid #3a3f4b",
                background: "#0f1724",
                color: "#ffffff",
                padding: 12,
                cursor: "pointer"
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.9 }}>{m.email}</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>Products: {m.totalProducts}</div>
              <div style={{ fontSize: 13 }}>Boxes: {m.totalBoxes}</div>
              <div style={{ fontSize: 13 }}>
                Status: S {m.shippedProducts} / V {m.verifiedProducts} / Sold {m.soldProducts}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="fetched-product-card" style={{ marginBottom: 16 }}>
        <h4 style={{ marginTop: 0 }}>Filters & Sorting</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(180px, 1fr))", gap: 12 }}>
          <div>
            <label>Manufacturer</label>
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

          <div>
            <label>Batch</label>
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

          <div>
            <label>Status</label>
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

          <div>
            <label>Sort By</label>
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

          <div>
            <label>From Date</label>
            <input
              type="date"
              className="login-input"
              value={filters.fromDate}
              onChange={(e) => handleFilterChange("fromDate", e.target.value)}
            />
          </div>

          <div>
            <label>To Date</label>
            <input
              type="date"
              className="login-input"
              value={filters.toDate}
              onChange={(e) => handleFilterChange("toDate", e.target.value)}
            />
          </div>

          <div>
            <label>Sort Order</label>
            <select
              className="login-input"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange("sortOrder", e.target.value)}
            >
              <option value="desc">DESC</option>
              <option value="asc">ASC</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="btn-outline" onClick={resetFilters}>Reset Filters</button>
          </div>
        </div>
      </div>

      <div className="fetched-product-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ marginTop: 0 }}>Products ({total})</h4>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-outline" onClick={() => setSort("createdAt")}>Sort Date</button>
            <button className="btn-outline" onClick={() => setSort("batchId")}>Sort Batch</button>
            <button className="btn-outline" onClick={() => setSort("manufacturer")}>Sort Manufacturer</button>
          </div>
        </div>

        {loading ? (
          <p>Loading products...</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Manufacturer</th>
                  <th>Box</th>
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
                    <td>{p.batchId}</td>
                    <td>{p.lifecycle}</td>
                    <td>{p.shipped ? "Yes" : "No"}</td>
                    <td>{p.verified ? "Yes" : "No"}</td>
                    <td>{p.sold ? "Yes" : "No"}</td>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          onClick={() => handleShip(p)}
                          disabled={actionLoadingKey === `ship-${p.id}`}
                        >
                          Ship Box
                        </button>
                        <button
                          onClick={() => handleVerify(p)}
                          disabled={actionLoadingKey === `verify-${p.id}`}
                        >
                          Verify
                        </button>
                        <button
                          onClick={() => handleMarkSold(p)}
                          disabled={actionLoadingKey === `sold-${p.id}`}
                        >
                          Mark Sold
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", padding: 16 }}>
                      No products found for current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <button
            className="btn-outline"
            disabled={filters.page <= 1}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Previous
          </button>
          <span>Page {filters.page} of {totalPages}</span>
          <button
            className="btn-outline"
            disabled={filters.page >= totalPages}
            onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {statusMessage && <div className="login-error" style={{ marginTop: 20 }}>{statusMessage}</div>}
    </div>
  );
};

export default AdminDashboard;
