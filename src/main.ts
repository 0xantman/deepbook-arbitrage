import { SuiClient } from "@mysten/sui/client";
import { getQuote, buildTx } from "@7kprotocol/sdk-ts";
import { Transaction, coinWithBalance } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import config from "./config";
import * as constants from "./constants";
import * as utils from "./utils";
import Decimal from "decimal.js";

async function arbitrage() {
  const suiClient = new SuiClient({ url: config.suiRpcUrl });

  const poolConfig = utils.getDeepbookPoolByName(config.deepbookPoolName);
  const baseCoinConfig = utils.getCoinBySymbol(poolConfig.baseCoinSymbol);
  const quoteCoinConfig = utils.getCoinBySymbol(poolConfig.quoteCoinSymbol);

  const privateKey = process.env.PRIVATE_KEY as string;
  if (!privateKey) {
    throw new Error("Sui private key is required");
  }
  const privateKeyPair = utils.getKeyPairByPrivateKey(privateKey);
  utils.log(`Using wallet: ${privateKeyPair.toSuiAddress()}`);

  // 1. get pyth price
  const baseCoinPythPrice = await utils.getPythPrice(
    baseCoinConfig.pythPriceId
  );
  utils.log(`${baseCoinConfig.symbol} oracle price: ${baseCoinPythPrice}`);

  // 2. calculate arbitrage price boundary
  const arbitrageUpperPrice =
    baseCoinPythPrice * (1 + config.arbitrageSlippage);
  const arbitrageLowerPrice =
    baseCoinPythPrice * (1 - config.arbitrageSlippage);
  utils.log(
    `arbitrage trigger price: ${arbitrageLowerPrice} / ${arbitrageUpperPrice}`
  );

  // 3. get deepbook order page
  const openOrders = await utils.getDeepbookOpenOrders(
    poolConfig.poolId,
    baseCoinConfig.type,
    quoteCoinConfig.type,
    baseCoinConfig.decimal,
    quoteCoinConfig.decimal,
    suiClient
  );
  const bestBidPrice = Math.max(
    ...openOrders.filter((o) => o.isBid).map((o) => parseFloat(o.price))
  );
  const bestAskPrice = Math.min(
    ...openOrders.filter((o) => !o.isBid).map((o) => parseFloat(o.price))
  );
  utils.log(
    `Total open orders: ${openOrders.length}, best price: ${bestBidPrice} / ${bestAskPrice}`
  );

  // 4. determine if there is an arbitrage opportunity and arbitrage order side
  const isArbitrageOpportunity =
    bestBidPrice >= arbitrageUpperPrice || bestAskPrice <= arbitrageLowerPrice;
  if (!isArbitrageOpportunity) {
    utils.log("No arbitrage opportunity found");
    return;
  } else {
    utils.log("Arbitrage opportunity found");
  }

  const arbitrageOrderIsBid = bestAskPrice <= arbitrageLowerPrice;
  utils.log(`Arbitrage order side: ${arbitrageOrderIsBid ? "BUY" : "SELL"}`);

  // 5. calculate arbitrage order quantity & estimate profit
  const ordersToFill = openOrders.filter(
    (order) =>
      (arbitrageOrderIsBid &&
        !order.isBid &&
        parseFloat(order.price) <= arbitrageLowerPrice) ||
      (!arbitrageOrderIsBid &&
        order.isBid &&
        parseFloat(order.price) >= arbitrageUpperPrice)
  );
  const baseQuantityToFill = ordersToFill.reduce(
    (sum, order) =>
      sum + parseFloat(order.quantity) - parseFloat(order.filledQuantity),
    0
  );
  const quoteQuantityToFill = ordersToFill.reduce((sum, order) => {
    const remainQuantity = new Decimal(order.quantity).minus(
      order.filledQuantity
    );
    const remainQuoteQuantity = remainQuantity.mul(new Decimal(order.price));
    return new Decimal(sum).plus(remainQuoteQuantity).toNumber();
  }, 0);

  utils.log(
    `${ordersToFill.length} ${
      arbitrageOrderIsBid ? "asks" : "bids"
    } to fill, total base quantity: ${baseQuantityToFill} ${
      baseCoinConfig.symbol
    }, total quote cost: ${quoteQuantityToFill} ${quoteCoinConfig.symbol}`
  );

  let estimatedProfit: number;
  if (arbitrageOrderIsBid) {
    estimatedProfit = ordersToFill.reduce(
      (sum, order) =>
        sum +
        (baseCoinPythPrice - parseFloat(order.price)) *
          (parseFloat(order.quantity) - parseFloat(order.filledQuantity)),
      0
    );
  } else {
    estimatedProfit = ordersToFill.reduce(
      (sum, order) =>
        sum +
        (parseFloat(order.price) - baseCoinPythPrice) *
          (parseFloat(order.quantity) - parseFloat(order.filledQuantity)),
      0
    );
  }
  utils.log(`Estimated profit: ${estimatedProfit} ${quoteCoinConfig.symbol}`);

  // 6. get wallet balances
  const walletBalances = await suiClient.getAllBalances({
    owner: privateKeyPair.toSuiAddress(),
  });
  const nativeBaseBalance =
    walletBalances.find((balance) => balance.coinType === baseCoinConfig.type)
      ?.totalBalance || "0";
  const nativeQuoteBalance =
    walletBalances.find((balance) => balance.coinType === quoteCoinConfig.type)
      ?.totalBalance || "0";
  const uiBaseBalance = parseFloat(
    utils.nativeToUi(nativeBaseBalance, baseCoinConfig.decimal)
  );
  const uiQuoteBalance = parseFloat(
    utils.nativeToUi(nativeQuoteBalance, quoteCoinConfig.decimal)
  );
  utils.log(
    `Wallet balance: ${uiBaseBalance} ${baseCoinConfig.symbol}, ${uiQuoteBalance} ${quoteCoinConfig.symbol}`
  );

  if (uiQuoteBalance < quoteQuantityToFill) {
    utils.log(
      `Insufficient ${quoteCoinConfig.symbol} balance to fill arbitrage order, need ${quoteQuantityToFill}, available ${uiQuoteBalance}`
    );
    return;
  }

  // 7. swap quote coin to base coin if needed
  if (!arbitrageOrderIsBid) {
    const quoteResponse = await getQuote({
      tokenIn: quoteCoinConfig.type,
      tokenOut: baseCoinConfig.type,
      amountIn: utils.uiToNative(
        quoteQuantityToFill.toString(),
        quoteCoinConfig.decimal
      ),
    });
    const estimateAmountOut = quoteResponse.returnAmount;
    utils.log(
      `estimate swap ${quoteQuantityToFill} ${quoteCoinConfig.symbol} for ${estimateAmountOut} ${baseCoinConfig.symbol}`
    );

    const swapCoin = coinWithBalance({
      type: quoteCoinConfig.type,
      balance: BigInt(
        utils.uiToNative(
          quoteQuantityToFill.toString(),
          quoteCoinConfig.decimal
        )
      ),
    });

    const preArbTx = new Transaction();

    const { tx, coinOut } = await buildTx({
      quoteResponse,
      accountAddress: privateKeyPair.toSuiAddress(),
      slippage: config.swapSlippage,
      commission: {
        partner: privateKeyPair.toSuiAddress(),
        commissionBps: 0,
      },
      extendTx: {
        tx: preArbTx,
        coinIn: swapCoin,
      },
    });

    if (!coinOut) {
      throw new Error("Failed to get coinOut from swap transaction");
    }

    preArbTx.transferObjects([coinOut], privateKeyPair.toSuiAddress());

    preArbTx.setGasBudget(constants.GAS_BUDGET);
    const txResult = await utils.executeTransaction(
      suiClient,
      preArbTx,
      privateKeyPair
    );
    utils.log(`pre-arbitrage tx digest: ${txResult.digest}`);

    const swapOutAmount = utils.getSwapOutAmount(
      txResult,
      baseCoinConfig.decimal
    );

    utils.log(
      `swap ${quoteQuantityToFill} ${quoteCoinConfig.symbol} for ${swapOutAmount} ${baseCoinConfig.symbol}`
    );
  }

  // 8. deposit into balance manager
  const depositCoinConfig = arbitrageOrderIsBid
    ? quoteCoinConfig
    : baseCoinConfig;
  const withdrawalCoinConfig = arbitrageOrderIsBid
    ? baseCoinConfig
    : quoteCoinConfig;

  const depositCoinAmount = arbitrageOrderIsBid
    ? quoteQuantityToFill
    : baseQuantityToFill;
  const nativeDepositCoinAmount = utils.uiToNative(
    depositCoinAmount.toString(),
    depositCoinConfig.decimal
  );

  utils.log(
    `Deposit ${depositCoinAmount} ${depositCoinConfig.symbol} into balance manager`
  );

  const arbTx = new Transaction();
  const depositCoin = coinWithBalance({
    type: depositCoinConfig.type,
    balance: BigInt(nativeDepositCoinAmount),
  });
  arbTx.moveCall({
    target: `${constants.deepbookPackageId}::balance_manager::deposit`,
    arguments: [arbTx.object(config.deepbookBalanceManagerId), depositCoin],
    typeArguments: [depositCoinConfig.type],
  });

  const tradeProof = arbTx.moveCall({
    target: `${constants.deepbookPackageId}::balance_manager::generate_proof_as_owner`,
    arguments: [arbTx.object(config.deepbookBalanceManagerId)],
  });

  const nativeOrderQuantity = utils.uiToNative(
    baseQuantityToFill.toString(),
    baseCoinConfig.decimal
  );
  utils.log(
    `Market arbitrage order quantity: ${baseQuantityToFill} ${baseCoinConfig.symbol}`
  );

  arbTx.moveCall({
    target: `${constants.deepbookPackageId}::pool::place_market_order`,
    arguments: [
      arbTx.object(poolConfig.poolId),
      arbTx.object(config.deepbookBalanceManagerId),
      tradeProof,
      arbTx.pure.u64("1"), // client order id
      arbTx.pure.u8(0), // self matching option, 0 - self match allowed, 1 - cancel taker, 2 - cancel maker
      arbTx.pure.u64(nativeOrderQuantity),
      arbTx.pure.bool(arbitrageOrderIsBid),
      arbTx.pure.bool(true), // pay with deep
      arbTx.object(SUI_CLOCK_OBJECT_ID),
    ],
    typeArguments: [baseCoinConfig.type, quoteCoinConfig.type],
  });

  const withdrawalCoin = arbTx.moveCall({
    target: `${constants.deepbookPackageId}::balance_manager::withdraw_all`,
    arguments: [arbTx.object(config.deepbookBalanceManagerId)],
    typeArguments: [withdrawalCoinConfig.type],
  });

  arbTx.transferObjects([withdrawalCoin], privateKeyPair.toSuiAddress());

  arbTx.setGasBudget(constants.GAS_BUDGET);

  const arbTxResult = await utils.executeTransaction(
    suiClient,
    arbTx,
    privateKeyPair
  );
  utils.log(`arbitrage tx digest: ${arbTxResult.digest}`);

  const withdrawalEvent = arbTxResult.events!.find(
    (event) =>
      event.type.endsWith("::balance_manager::BalanceEvent") &&
      !(event.parsedJson as any)["deposit"]
  );
  if (!withdrawalEvent) {
    throw new Error("Withdrawal event not found in transaction result");
  }
  const withdrawalAmount = utils.nativeToUi(
    (withdrawalEvent.parsedJson as any)["amount"],
    withdrawalCoinConfig.decimal
  );
  utils.log(
    `Withdraw ${withdrawalAmount} ${withdrawalCoinConfig.symbol} from balance manager`
  );

  // 9. check swap base coin to quote coin if needed
  if (arbitrageOrderIsBid) {
    const walletBalances = await suiClient.getAllBalances({
      owner: privateKeyPair.toSuiAddress(),
    });
    const nativeBaseBalance =
      walletBalances.find((balance) => balance.coinType === baseCoinConfig.type)
        ?.totalBalance || "0";

    const uiBaseBalance = parseFloat(
      utils.nativeToUi(nativeBaseBalance, baseCoinConfig.decimal)
    );

    utils.log(`Wallet balance: ${uiBaseBalance} ${baseCoinConfig.symbol}`);

    if (uiBaseBalance > 0) {
      const quoteResponse = await getQuote({
        tokenIn: baseCoinConfig.type,
        tokenOut: quoteCoinConfig.type,
        amountIn: nativeBaseBalance,
      });
      const estimateAmountOut = quoteResponse.returnAmount;
      utils.log(
        `post arb. estimate swap ${uiBaseBalance} ${baseCoinConfig.symbol} for ${estimateAmountOut} ${quoteCoinConfig.symbol}`
      );

      const swapCoin = coinWithBalance({
        type: baseCoinConfig.type,
        balance: BigInt(nativeBaseBalance),
      });

      const postArbSwapTx = new Transaction();

      const { tx, coinOut } = await buildTx({
        quoteResponse,
        accountAddress: privateKeyPair.toSuiAddress(),
        slippage: config.swapSlippage,
        commission: {
          partner: privateKeyPair.toSuiAddress(),
          commissionBps: 0,
        },
        extendTx: {
          tx: postArbSwapTx,
          coinIn: swapCoin,
        },
      });

      if (!coinOut) {
        throw new Error("Failed to get coinOut from swap transaction");
      }

      postArbSwapTx.transferObjects([coinOut], privateKeyPair.toSuiAddress());

      postArbSwapTx.setGasBudget(constants.GAS_BUDGET);

      const postSwapTxResult = await utils.executeTransaction(
        suiClient,
        postArbSwapTx,
        privateKeyPair
      );
      utils.log(`post-arbitrage tx digest: ${postSwapTxResult.digest}`);

      const swapOutAmount = utils.getSwapOutAmount(
        postSwapTxResult,
        quoteCoinConfig.decimal
      );
      utils.log(
        `swap ${uiBaseBalance} ${baseCoinConfig.symbol} for ${swapOutAmount} ${quoteCoinConfig.symbol}`
      );
    }
  }
}

async function main() {
  try {
    await arbitrage();
  } catch (error) {
    console.error("Arbitrage failed:", error);
  }
  setTimeout(main, config.arbitrageInterval);
}

main();
