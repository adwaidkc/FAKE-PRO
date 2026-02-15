// src/components/AdminDashboard.js
import React, { useState } from "react";
import { getProduct, getProductIdsByBox, shipBox, verifyProduct, saleComplete, } from "../../trustChain";
import "../../index2.css";

const AdminDashboard = () => {
  const [boxId, setBoxId] = useState("");
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState("");

  const [walletConnected, setWalletConnected] = useState(false);

  const handleConnect = async () => {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      setWalletConnected(true);
      setStatus("");
    } catch (e) {
      setWalletConnected(false);
      setStatus("Wallet connect failed: " + e.message);
    }
  };

  const fetchBoxProducts = async () => {
    try {
      setStatus("");
      setProducts([]);
      if (!boxId) return;
      const ids = await getProductIdsByBox(boxId);
      const fetched = [];
      for (const id of ids) {
        const p = await getProduct(id);
        fetched.push(p);
      }
      setProducts(fetched);
      setStatus(`Box ${boxId} has ${fetched.length} products.`);
    } catch (e) {
      setStatus("Fetch failed: " + e.message);
    }
  };

  const handleShip = async (productId) => {
    try {
      await shipBox(productId);
      setStatus(`Product ${productId} marked as shipped.`);
      fetchBoxProducts(); // Refresh the product list
    } catch (e) {
      setStatus("Ship failed: " + e.message);
    }
  };

  const handleVerify = async (productId) => {
    try {
      await verifyProduct(productId);
      setStatus(`Product ${productId} verified.`);
      fetchBoxProducts(); // Refresh the product list
    } catch (e) {
      setStatus("Verify failed: " + e.message);
    }
  };

  const handleMarkSold = async (productId) => {
    try {
      await saleComplete(productId);
      setStatus(`Product ${productId} marked as sold.`);
    } catch (e) {
      setStatus("Mark sold failed: " + e.message);
    }
  };

  return (
    <div className="premium-dashboard" style={{ width: "100vw", padding: 20 }}>
      <h2>Admin Dashboard</h2>
      <div className="form-row center" style={{ marginBottom: 20 }}>
        <button className={`btn-primary ${walletConnected ? "connected" : ""}`} onClick={handleConnect}>
          {walletConnected ? "Connected" : "Connect Wallet"}
        </button>
      </div>

      <div className="form-row" style={{ marginBottom: 20 }}>
        <input
          type="text"
          className="login-input"
          placeholder="Enter Box ID"
          value={boxId}
          onChange={(e) => setBoxId(e.target.value)}
        />
        <button className="btn-outline" onClick={fetchBoxProducts}>Fetch Products</button>
      </div>

      {products.length > 0 && (
        <div className="fetched-product-card" style={{ marginTop: 20 }}>
          <h4>Products in Box {boxId}</h4>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Shipped</th>
                <th>Verified</th>
                <th>Sold</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.productId}>
                  <td>{p.productId}</td>
                  <td>{p.name}</td>
                  <td>{p.shipped ? "✔" : "❌"}</td>
                  <td>{p.verifiedByRetailer ? "✔" : "❌"}</td>
                  <td>{p.sold ? "✔" : "❌"}</td>
                  <td>
                    <button onClick={() => handleShip(p.productId)}>Ship</button>
                    <button onClick={() => handleVerify(p.productId)}>Verify</button>
                    <button onClick={() => handleMarkSold(p.productId)}>Mark Sold</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {status && <div className="login-error" style={{ marginTop: 20 }}>{status}</div>}
    </div>
  );
};

export default AdminDashboard;
