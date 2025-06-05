import { Transaction } from "@mysten/sui/transactions";
import { SuiClient, SuiTransactionBlockResponse } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { HermesClient } from "@pythnetwork/hermes-client";
import Decimal from "decimal.js";
import config from "./config";
import * as constants from "./constants";
import * as types from "./types";

export function getDeepbookPoolByName(poolName: string) {
  const poolConfig = constants.deepbookPools.find(
    (pool) => pool.poolName === poolName
  );
  if (!poolConfig) {
    throw new Error(`Pool with name ${poolName} not found`);
  }
  return poolConfig;
}

export function getCoinBySymbol(symbol: string) {
  const coinConfig = constants.coins.find((coin) => coin.symbol === symbol);
  if (!coinConfig) {
    throw new Error(`Coin with symbol ${symbol} not found`);
  }
  return coinConfig;
}

export async function getPythPrice(priceId: string): Promise<number> {
  const pythConnection = new HermesClient(config.pythEndpointUrl, {});
  const priceIds = [priceId];
  const priceUpdates = await pythConnection.getLatestPriceUpdates(priceIds);

  const pythNativePrice = priceUpdates.parsed![0].price.price;
  const pythPriceExpo = priceUpdates.parsed![0].price.expo;
  const uiPrice = parseInt(pythNativePrice) * 10 ** pythPriceExpo;
  return uiPrice;
}

export function toUiDeepbookPrice(
  nativePrice: string,
  baseCoinDecimal: number,
  quoCointeDecimal: number
): string {
  const nativePriceDM = new Decimal(nativePrice);
  const scalar = new Decimal(10).pow(9);
  const baseFactor = new Decimal(10).pow(baseCoinDecimal);
  const quoteFactor = new Decimal(10).pow(quoCointeDecimal);

  const uiPriceDM = nativePriceDM.div(scalar).mul(baseFactor).div(quoteFactor);
  return uiPriceDM.toString();
}

export function toNativeDeepbookPrice(
  uiPrice: string,
  baseCoinDecimal: number,
  quoCointeDecimal: number
): string {
  const uiPriceDM = new Decimal(uiPrice);
  const scalar = new Decimal(10).pow(9);
  const baseFactor = new Decimal(10).pow(baseCoinDecimal);
  const quoteFactor = new Decimal(10).pow(quoCointeDecimal);

  const nativePriceDM = uiPriceDM.mul(scalar).div(baseFactor).mul(quoteFactor);
  return nativePriceDM.toString();
}

export function nativeToUi(nativeNumber: string, decimal: number): string {
  const nativeNumberDM = new Decimal(nativeNumber);
  const factor = new Decimal(10).pow(decimal);

  return nativeNumberDM.div(factor).toString();
}

export function uiToNative(uiNumber: string, decimal: number): string {
  const uiNumberDM = new Decimal(uiNumber);
  const factor = new Decimal(10).pow(decimal);

  return uiNumberDM.mul(factor).toString();
}

export function decodeDeepbookOrderId(
  encodedOrderId: string
): types.DeepbookDecodedOrderId {
  const encodedOrderIdBigInt = BigInt(encodedOrderId);
  const isBid = encodedOrderIdBigInt >> BigInt(127) === BigInt(0);
  const price =
    (encodedOrderIdBigInt >> BigInt(64)) &
    BigInt((1n << BigInt(63)) - BigInt(1));

  const orderId = encodedOrderIdBigInt & BigInt((1n << BigInt(64)) - BigInt(1));

  return { isBid, price: price.toString(), orderId: orderId.toString() };
}

export async function getDeepbookOpenOrders(
  poolId: string,
  baseCoinType: string,
  quoteCoinType: string,
  baseCoinDecimal: number,
  quoteCoinDecimal: number,
  suiClient: SuiClient
): Promise<types.DeepbookOpenOrder[]> {
  const tx = new Transaction();
  tx.moveCall({
    target: `${constants.deepbookPackageId}::order_query::iter_orders`,
    arguments: [
      tx.object(poolId),
      tx.pure.option("u128", null),
      tx.pure.option("u128", null),
      tx.pure.option("u64", null),
      tx.pure.u64(1000),
      tx.pure.bool(true),
    ],
    typeArguments: [baseCoinType, quoteCoinType],
  });
  tx.moveCall({
    target: `${constants.deepbookPackageId}::order_query::iter_orders`,
    arguments: [
      tx.object(poolId),
      tx.pure.option("u128", null),
      tx.pure.option("u128", null),
      tx.pure.option("u64", null),
      tx.pure.u64(1000),
      tx.pure.bool(false),
    ],
    typeArguments: [baseCoinType, quoteCoinType],
  });

  const txResult = await suiClient.devInspectTransactionBlock({
    sender: poolId,
    transactionBlock: tx,
  });

  const bidsRawData = txResult.results![0].returnValues![0][0];
  const asksRawData = txResult.results![1].returnValues![0][0];

  const bidsOrderPage = types.BcsOrderPage.parse(Uint8Array.from(bidsRawData));
  const asksOrderPage = types.BcsOrderPage.parse(Uint8Array.from(asksRawData));
  const orderPageOrders = [...bidsOrderPage.orders, ...asksOrderPage.orders];

  const orders: types.DeepbookOpenOrder[] = [];
  for (const order of orderPageOrders) {
    const { price, isBid, orderId } = decodeDeepbookOrderId(
      order.orderId.toString()
    );

    orders.push({
      ...order,
      price: toUiDeepbookPrice(price, baseCoinDecimal, quoteCoinDecimal),
      isBid,
      quantity: nativeToUi(order.quantity, baseCoinDecimal),
      filledQuantity: nativeToUi(order.filledQuantity, baseCoinDecimal),
    });
  }
  return orders;
}

export function getKeyPairByPrivateKey(privateKey: string): Ed25519Keypair {
  const { schema, secretKey } = decodeSuiPrivateKey(privateKey);
  if (schema != "ED25519") {
    throw new Error(`Unsupported private key schema: ${schema}`);
  }

  return Ed25519Keypair.fromSecretKey(secretKey);
}

export function log(message: string) {
  console.log(`[${new Date().toLocaleString()}] ${message}`);
}

export async function executeTransaction(
  client: SuiClient,
  tx: Transaction,
  signer: any
) {
  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });

  if (result.effects?.status.status === "failure") {
    throw new Error(`Transaction failed: ${result.effects.status.error}`);
  }

  return result;
}

export function getSwapOutAmount(
  txResult: SuiTransactionBlockResponse,
  coinDecimal: number
): string {
  const swapSettleEvent = txResult.events!.find((event) =>
    event.type.endsWith("::settle::Swap")
  );
  if (!swapSettleEvent) {
    throw new Error("Swap settle event not found in transaction result");
  }

  return nativeToUi(
    (swapSettleEvent.parsedJson as any)["amount_out"],
    coinDecimal
  );
}
