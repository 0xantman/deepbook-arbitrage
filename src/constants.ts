import * as types from "./types";

export const coins: types.CoinConfig[] = [
  {
    symbol: "DORI",
    address:
      "0xc436a8ccc36e649e0fd8c7cec88ca89747b69ba5bdefb15be2f93ae1ae632800",
    type: "0xc436a8ccc36e649e0fd8c7cec88ca89747b69ba5bdefb15be2f93ae1ae632800::dori::DORI",
    decimal: 9,
    pythPriceId:
      null,
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
      "0x2ea6691f0654bd9acadf4c26326fbcced6eaf0b5f64938c618a05ea64ca0d830",
    baseCoinSymbol: "DORI",
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
