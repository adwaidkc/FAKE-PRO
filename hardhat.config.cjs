// require("@nomicfoundation/hardhat-toolbox");

// module.exports = {
//   solidity: {
//     version: "0.8.20",
//     settings: {
//       optimizer: {
//         enabled: true,
//         runs: 200
//       },
//       viaIR: true
//     }
//   },
//   networks: {
//     localhost: {
//       url: "http://127.0.0.1:8545"
//     }
//   }
// };



   require("@nomicfoundation/hardhat-toolbox");
   require("dotenv").config();

   const { RPC_URL, PRIVATE_KEY } = process.env;
   const networks = {
     localhost: { url: "http://127.0.0.1:8545" }
   };

   if (RPC_URL && PRIVATE_KEY) {
     networks.sepolia = {
       url: RPC_URL,
       accounts: [PRIVATE_KEY]
     };
   }

   module.exports = {
     solidity: {
       version: "0.8.20",
       settings: { optimizer: { enabled: true, runs: 200 }, viaIR: true }
     },
     networks
   };
