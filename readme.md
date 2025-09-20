# Vault dApp (Solidity + React)
I built a simmple ETH sepolia DApp where users can deposit ETH into a vault, view their locked value and also view the vault TVL (total value locked, across all users). Users can keep their money on the smart contract or if they want to withdraw thats also possible.

End-to-end ETH Vault:
- **Smart contract**: Solidity + Foundry (tests, scripts).
- **Frontend**: React + Tailwind + ethers v6.
- **Network**: Sepolia.
- **Verified contract**: 0xEFE71C11E3004eA17303CeF80295b2eE48927c75

## Structure
- `vault-foundry/` – contract (`src/Vault.sol`), tests (`test/`), deploy scripts (`script/`).
- `vault-frontend/` – React app (connect, balances, TVL, deposit/withdraw, event-driven refresh).

## Run locally

```bash
cd vault-foundry
forge test -vv
anvil  # in a separate terminal
# deploy local or to Sepolia with .env: SEPOLIA_RPC, PRIVATE_KEY

### Frontend
cd vault-frontend
cp .env.example .env  # or create
# VITE_VAULT_ADDRESS=<deployed_address>
npm install
npm run dev



