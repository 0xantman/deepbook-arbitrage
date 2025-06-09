# 🧠 Deepbook Arbitrage Bot
A high-frequency arbitrage bot built on the Sui mainnet. It identifies profitable opportunities across DeepBook and 7kprotocol, and executes trades based on customizable slippage and interval settings.


## 🚀 Getting Started
1. Install dependencies
```bash
npm install
```

2. Configure your settings
Edit src/config.ts with your custom parameters:
```typescript
export const config = {
  deepbookBalanceManagerId: 'YOUR_BALANCE_MANAGER_ID', // DeepBook Balance Manager ID
  suiRpcUrl: 'https://YOUR_CUSTOM_RPC_URL',            // Optional: Custom Sui RPC URL
  arbitrageSlippage: 0.01,                             // Trigger slippage for arbitrage (e.g., 0.01 = 1%)
  swapSlippage: 0.01,                                  // Slippage tolerance for base token swap via 7k (e.g., 0.01 = 1%)
  arbitrageInterval: 30000                             // Script run interval in milliseconds (e.g., 30000 = 30 seconds)
}
```

3. Set your wallet private key
Export your wallet private key as an environment variable:
```bash
export PRIVATE_KEY=YOUR_WALLET_PRIVATE_KEY
```

4. Run the bot
```bash
ts-node src/main.ts
```


## 🛠 Future Work
1. Integrate flashloan support to maximize capital efficiency

2. Use centralized exchanges (CEX) as hedge pools