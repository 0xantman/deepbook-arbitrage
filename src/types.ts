import { bcs } from "@mysten/sui/bcs";

export interface CoinConfig {
  symbol: string;
  address: string;
  type: string;
  decimal: number;
  pythPriceId: string;
}

export interface DeepbookPoolConfig {
  poolName: string;
  poolId: string;
  baseCoinSymbol: string;
  quoteCoinSymbol: string;
  tickSize: string;
  lotSize: string;
  minSize: string;
  takerFeeBps: number;
  makerFeeBps: number;
}

export const BcsOrderDeepPrice = bcs.struct("OrderDeepPrice", {
  assetIsBase: bcs.bool(),
  deepPerAsset: bcs.u64(),
});

export const BcsOrder = bcs.struct("Order", {
  balanceManagerId: bcs.Address,
  orderId: bcs.u128(),
  clientOrderId: bcs.u64(),
  quantity: bcs.u64(),
  filledQuantity: bcs.u64(),
  feeIsDeep: bcs.bool(),
  orderDeepPrice: BcsOrderDeepPrice,
  epoch: bcs.u64(),
  status: bcs.u8(),
  expireTimestamp: bcs.u64(),
});

export const BcsOrderPage = bcs.struct("OrderPage", {
  orders: bcs.vector(BcsOrder),
  hasNextPage: bcs.bool(),
});

export interface DeepbookDecodedOrderId {
  isBid: boolean;
  price: string;
  orderId: string;
}

export interface DeepbookDeepPrice {
  assetIsBase: boolean;
  deepPerAsset: string;
}

export interface DeepbookOpenOrder {
  balanceManagerId: string;
  orderId: string;
  clientOrderId: string;
  quantity: string;
  filledQuantity: string;
  feeIsDeep: boolean;
  orderDeepPrice: DeepbookDeepPrice;
  epoch: string;
  status: number;
  expireTimestamp: string;
  isBid: boolean;
  price: string;
}
