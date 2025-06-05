import * as types from "./types";

export const coins: types.CoinConfig[] = [
  {
    symbol: "LBTC",
    address:
      "0x3e8e9423d80e1774a7ca128fccd8bf5f1f7753be658c5e645929037f7c819040",
    type: "0x3e8e9423d80e1774a7ca128fccd8bf5f1f7753be658c5e645929037f7c819040::lbtc::LBTC",
    decimal: 8,
    pythPriceId:
      "0x8f257aab6e7698bb92b15511915e593d6f8eae914452f781874754b03d0c612b",
  },
  {
    symbol: "USDC",
    address:
      "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7",
    type: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    decimal: 6,
    pythPriceId:
      "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  },
  {
    symbol: "DEEP",
    address:
      "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270",
    type: "0xdeeb7a4662eec9f2f3def03fb937a663dddaa2e215b8078a284d026b7946c270::deep::DEEP",
    decimal: 6,
    pythPriceId:
      "0x29bdd5248234e33bd93d3b81100b5fa32eaa5997843847e2c2cb16d7c6d9f7ff",
  },
  {
    symbol: "SUI",
    address: "0x2",
    type: "0x2::sui::SUI",
    decimal: 9,
    pythPriceId:
      "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744",
  },
];

export const deepbookPools: types.DeepbookPoolConfig[] = [
  {
    poolName: "LBTC_USDC",
    poolId:
      "0xd9474556884afc05b31272823a31c7d1818b4c0951b15a92f576163ecb432613",
    baseCoinSymbol: "LBTC",
    quoteCoinSymbol: "USDC",
    tickSize: "1",
    lotSize: "0.00001",
    minSize: "0.00001",
    takerFeeBps: 10,
    makerFeeBps: 5,
  },
];

export const deepbookPackageId =
  "0xcaf6ba059d539a97646d47f0b9ddf843e138d215e2a12ca1f4585d386f7aec3a";
export const deepbookRegistryId =
  "0xaf16199a2dff736e9f07a845f23c5da6df6f756eddb631aed9d24a93efc4549d";

export const GAS_BUDGET = 1_000_000_000;
