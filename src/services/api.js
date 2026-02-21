// frontend/src/services/api.js

// frontend/src/services/api.js

const BASE_URL = "http://localhost:5000";

function getAuthHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };
}

export async function requestChallenge(productId) {
  const res = await fetch(`${BASE_URL}/challenge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId })
  });

  if (!res.ok) {
    throw new Error("Failed to get challenge");
  }

  const data = await res.json();

  console.log("API DEBUG /challenge response:", data);

  return data; // MUST be { challenge: "..." }
}


export async function verifyResponse(productId, response) {
  const res = await fetch(`${BASE_URL}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ productId, response })
  });

  if (!res.ok) {
    throw new Error("Verification request failed");
  }

  return res.json();
}

export async function fetchAdminManufacturers() {
  const res = await fetch(`${BASE_URL}/api/admin/manufacturers`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch manufacturers");
  }

  return res.json();
}

export async function fetchAdminBatches(manufacturerId) {
  const qs = manufacturerId ? `?manufacturerId=${encodeURIComponent(manufacturerId)}` : "";
  const res = await fetch(`${BASE_URL}/api/admin/batches${qs}`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch batches");
  }

  return res.json();
}

export async function fetchAdminProducts(params = {}) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });

  const res = await fetch(`${BASE_URL}/api/admin/products?${search.toString()}`, {
    headers: getAuthHeaders()
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch products");
  }

  return res.json();
}
