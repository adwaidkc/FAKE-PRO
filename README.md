# FAKE-PRODUCT

NFC + Blockchain based product authenticity and lifecycle tracking system.

## Overview
This project uses:
- React + Vite frontend dashboards (Admin, Manufacturer, Retailer, User)
- Node/Express backend with Prisma + PostgreSQL
- Solidity smart contract (`TrustChain.sol`) on Hardhat
- NFC challenge-response verification flow for customer authenticity checks

Core intent:
- Manufacturer registers products in batches/boxes on-chain
- Backend finalizes DB only after successful on-chain transaction
- Retailer verifies incoming boxes/products
- Products are marked sold and can be checked by end users

## Current Flow
1. Manufacturer prepares batch (`/prepare-batch`) and gets a signed draft token.
2. Frontend sends on-chain `registerBatchProducts(...)` transaction.
3. Frontend calls `/finalize-batch` with `draftToken + txHash`.
4. Backend verifies tx input/receipt and writes Box/Product rows to DB.
5. Ship/Verify/Sold actions update chain first, then sync DB state.
6. User dashboard verifies authenticity using challenge-response NFC flow (`/challenge` -> `/verify`).

## Key Implemented Changes
- Added 2-step safe registration flow: `prepare-batch` + `finalize-batch`.
- Admin dashboard redesigned with improved filters, box-id filtering, manufacturer overview, and status styling.
- Admin actions now operate box-wise for ship/verify/sold.
- Contract supports single-transaction box sell: `saleBox(string boxId)`.
- Retailer dashboard simplified: product verification by Product ID only (dynamic seal UI removed).
- User dashboard verification result UI upgraded with richer product/status presentation.
- Box shipping address added:
  - DB column on `Box.shippingAddress`
  - Manufacturer Ship Box form now captures shipping address
  - Ship sync endpoint stores shipping address
- Status message styling now supports semantic types (`success/info/warning/error`) instead of only red.

## Project Structure (Current)
```
FAKE-PRODUCT/
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── middleware/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── nfc_emulator/
│   └── abi.json
├── contracts/
│   └── TrustChain.sol
├── scripts/
│   └── deploy.cjs
├── src/
│   ├── pages/Dashboards/
│   │   ├── AdminDashboard.jsx
│   │   ├── ManufacturerDashboard.jsx
│   │   ├── RetailerDashboard.jsx
│   │   └── UserDashboard.jsx
│   ├── services/api.js
│   ├── trustChain.js
│   ├── TrustChainAbi.json
│   └── index2.css
├── hardhat.config.cjs
└── package.json
```

## Setup
Use separate terminals.

### 1) Start Hardhat local chain
```bash
npx hardhat node
```

### 2) Compile + deploy contract
```bash
npx hardhat compile
npx hardhat run scripts/deploy.cjs --network localhost
```

Copy deployed contract address.

### 3) Configure env
Frontend (`.env` in project root):
```env
VITE_CONTRACT_ADDRESS=0x...
```

Backend (`backend/.env`):
```env
RPC_URL=http://127.0.0.1:8545
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=0x...
JWT_SECRET=...
```

### 4) Run migrations
```bash
cd backend
npx prisma migrate dev
```

### 5) Start backend + frontend
```bash
cd backend
node server.js
```
```bash
npm run dev
```

Frontend URL:
`http://localhost:5173`

## Important Endpoints
- Auth: `/api/auth/register`, `/api/auth/login`
- Batch: `/prepare-batch`, `/finalize-batch`
- Admin queries: `/api/admin/manufacturers`, `/api/admin/batches`, `/api/admin/boxes`, `/api/admin/products`
- Sync:
  - `/api/db/box/:boxId/ship`
  - `/api/db/box/:boxId/verify`
  - `/api/db/box/:boxId/sold`
  - `/api/db/product/:productId/verify`
  - `/api/db/product/:productId/sold`
- Authenticity: `/challenge`, `/verify`

## Notes
- Chain and DB must both be running and pointed to the same contract address.
- If contract ABI or deployment changes, restart backend and frontend.
- If an on-chain tx succeeds but DB is stale, re-run/fix finalize or sync flow rather than manual DB edits.

## Current Known Constraints
- `boxId` is unique per manufacturer (not globally).
- Retailer sync may require explicit `manufacturerId` when ambiguous IDs exist across manufacturers.
- Full custody transfer model (manufacturer -> retailer -> customer wallets) is not yet enforced at contract level.
