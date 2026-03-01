import { useState } from "react";
import {
  ShieldCheck,
  Search,
  Smartphone,
  QrCode,
  Info,
  Tag,
  MapPin,
  CheckCircle2,
  XCircle,
  Truck,
  ShoppingCart,
  Boxes,
  CheckCheck
} from "lucide-react";
import { requestChallenge, verifyResponse } from "../../services/api";
import { scanNfcTag } from "../../nfc/nfcScanner";
import BackButton from "../../components/BackButton";
import "../../user.css";

export default function UserDashboard() {
  const userId = localStorage.getItem("authEmail") || "User";

  const [activeSection, setActiveSection] = useState("verify");
  const [status, setStatus] = useState("");
  const [product, setProduct] = useState(null);
  const [searching, setSearching] = useState(false);
  const [productId, setProductId] = useState("");

  const searchProductId = productId.trim();
  const isVerified = Boolean(product?.verifiedByRetailer);

  const getStatusTone = (message) => {
    const text = String(message || "").toLowerCase();
    if (!text) return "info";
    if (text.includes("❌") || text.includes("fake") || text.includes("failed")) return "error";
    if (text.includes("❗") || text.includes("please")) return "error";
    if (text.includes("🔄") || text.includes("📡") || text.includes("🔐")) return "info";
    if (text.includes("✅") || text.includes("genuine") || text.includes("verified")) return "success";
    return "info";
  };

  const handleScanAndVerify = async () => {
    if (!searchProductId) {
      setStatus("❗ Please enter a Product ID.");
      return;
    }

    try {
      setSearching(true);
      setProduct(null);
      setStatus("🔄 Requesting challenge...");

      const { challenge } = await requestChallenge(searchProductId);
      setStatus("📡 Signing challenge via NFC...");

      const response = await scanNfcTag(searchProductId, challenge);
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
      setSearching(false);
    }
  };

  return (
    <div className="user-page">
      <BackButton to="/roles" />

      <aside className="user-sidebar">
        <div className="user-brand">
          <img src="/bc1.png" alt="TrustChain Logo" />
          <h2>TrustChain</h2>
        </div>

        <div className="user-profile-card">
          <div className="user-profile-avatar">{(userId || "U")[0].toUpperCase()}</div>
          <div>
            <div className="user-profile-name">User</div>
            <div className="user-profile-id">ID: {userId}</div>
          </div>
        </div>

        <button
          className={`user-sidebar-btn ${activeSection === "verify" ? "active" : ""}`}
          onClick={() => setActiveSection("verify")}
        >
          <QrCode size={16} /> Verify Product
        </button>

        <button
          className={`user-sidebar-btn ${activeSection === "about" ? "active" : ""}`}
          onClick={() => setActiveSection("about")}
        >
          <Info size={16} /> How It Works
        </button>
      </aside>

      <main className="user-main">
        {activeSection === "verify" && (
          <section className="user-card">
            <h2><ShieldCheck size={20} /> Product Verification Portal</h2>
            <p className="user-subtext">
              Enter a product ID and verify authenticity using challenge-response.
            </p>

            <div className="user-chip-row">
              <span>Challenge Response</span>
              <span>NFC Signature</span>
              <span>Anti-Counterfeit</span>
            </div>

            <div className="user-search-row">
              <div className="user-input-wrap">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Enter Product ID"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                />
              </div>
              <button className="btn-primary" onClick={handleScanAndVerify} disabled={searching}>
                {searching ? "Scanning NFC..." : "Scan NFC"}
              </button>
            </div>

            {status && <div className={`user-status ${getStatusTone(status)}`}>{status}</div>}

            <div className="user-checklist">
              <h4><CheckCheck size={16} /> Quick Buyer Checklist</h4>
              <p>If challenge-response fails, treat the product as suspicious.</p>
            </div>

            {product && (
              <div className="user-product-card">
                <div className="user-product-media">
                  <img src={product.image || "/mob.jpg"} alt={product.name || "Product"} />
                </div>

                <div className="user-product-body">
                  <div className={`user-result-banner ${product.sold ? "sold" : isVerified ? "verified" : "pending"}`}>
                    {product.sold
                      ? "Status: Previously sold product"
                      : isVerified
                        ? "Status: Verified distribution record"
                        : "Status: Pending full verification"}
                  </div>

                  <div className="user-product-grid">
                    <div><Tag size={14} /><span><strong>Product ID:</strong> {product.productId || ""}</span></div>
                    <div><Smartphone size={14} /><span><strong>Name:</strong> {product.name || ""}</span></div>
                    <div><MapPin size={14} /><span><strong>Manufacturer:</strong> {product.manufacturer || ""}</span></div>
                    <div><Tag size={14} /><span><strong>Model:</strong> {product.modelNumber || ""}</span></div>
                  </div>

                  <div className="user-status-row">
                    <StatusCard icon={Truck} label="Shipped" ok={product.shipped} />
                    <StatusCard icon={ShieldCheck} label="Verified" ok={product.verifiedByRetailer} />
                    <StatusCard icon={ShoppingCart} label="Sold" ok={product.sold} />
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {activeSection === "about" && (
          <section className="user-card">
            <h2><Info size={20} /> About TrustChain Verification</h2>
            <div className="user-about-list">
              <article>
                <span><Tag size={15} /></span>
                <div>
                  <h3>1. Product ID Input</h3>
                  <p>Enter product ID and request a challenge from the backend.</p>
                </div>
              </article>
              <article>
                <span><Search size={15} /></span>
                <div>
                  <h3>2. NFC Signature</h3>
                  <p>NFC module signs the challenge and returns a cryptographic response.</p>
                </div>
              </article>
              <article>
                <span><Boxes size={15} /></span>
                <div>
                  <h3>3. Backend Verification</h3>
                  <p>Backend verifies signature and authenticity before sharing product details.</p>
                </div>
              </article>
              <article>
                <span><ShieldCheck size={15} /></span>
                <div>
                  <h3>4. Safe Purchase</h3>
                  <p>Proceed only when product is marked genuine.</p>
                </div>
              </article>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function StatusCard({  label, ok }) {
  return (
    <div className="user-status-card">
      <div className="user-status-head">
        <Icon size={15} />
        <span>{label}</span>
      </div>
      {ok ? <CheckCircle2 className="ok" size={20} /> : <XCircle className="no" size={20} />}
    </div>
  );
}
