import { gql } from "@apollo/react-hooks";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import { TokenString } from "../../ethereum/tokens";

/* TokenAmount */

export interface RawTokenAmount {
    symbol: string;
    amount: string;
    amountInEth: string;
    amountInUsd: string;
    asset: {
        decimals: string;
        tokenAddress?: string;
    } | null;
}

export interface TokenAmount {
    symbol: string;
    amount: BigNumber;
    amountInEth: BigNumber;
    amountInUsd: BigNumber;
    asset: {
        decimals: number;
        tokenAddress?: string;
    } | null;
}

export type TokenAmountCollection = OrderedMap<string, TokenAmount>;

export const parseTokenAmount = (amount: RawTokenAmount): TokenAmount => ({
    ...amount,
    asset: amount.asset
        ? {
              ...amount.asset,
              decimals: parseInt(amount.asset.decimals),
          }
        : amount.asset,
    amount: new BigNumber(amount.amount),
    amountInUsd: new BigNumber(amount.amountInUsd),
    amountInEth: new BigNumber(amount.amountInEth),
});

export const multiplyTokenAmount = (
    amount: TokenAmount,
    scalar: BigNumber,
) => ({
    ...amount,
    amount: amount.amount.times(scalar),
    amountInUsd: amount.amountInUsd.times(scalar),
    amountInEth: amount.amountInEth.times(scalar),
});

/* QUERY_BLOCK **/

export const QUERY_BLOCK = gql`
    {
        renVM(id: "1") {
            activeBlock
            activeTimestamp
        }
    }
`;

export interface QueryBlockResponse {
    renVM: {
        activeBlock: string;
        activeTimestamp: string;
    };
}

/* RENVM **/

export const QUERY_RENVM_HISTORY = (
    block: number,
) => `block_${block}: renVM(id: "1", block: { number: ${block} }) {
    volume {
      symbol
      amount
      amountInEth
      amountInUsd
      asset {
        decimals
      }
    }

    locked {
      symbol
      amount
      amountInUsd
      asset {
        decimals
      }
    }
  }`;

export interface HistoricalRawRenVM {
    // id: string;
    // numberOfDarknodes: string;
    // numberOfDarknodesLastEpoch: string;
    // minimumBond: string;
    // minimumEpochInterval: string;
    // // currentCyclePayoutPercent: string;
    // currentEpoch: {
    //     epochhash: string;
    //     timestamp: string;
    //     rewardShares: Array<RawTokenAmount>;
    // };
    // previousEpoch: {
    //     epochhash: string;
    //     timestamp: string;
    //     rewardShares: Array<RawTokenAmount>;
    // };
    // currentCycle: string;
    // previousCycle: string;
    // deregistrationInterval: string;

    // btcMintFee: string;
    // btcBurnFee: string;

    volume: RawTokenAmount[];
    locked: Array<Omit<RawTokenAmount, "amountInEth">>;
}

export interface PeriodData {
    id: string; // "HOUR441028";
    date: number; // 1587700800;
    volume: OrderedMap<string, RawTokenAmount>;
    locked: OrderedMap<string, Omit<RawTokenAmount, "amountInEth">>;
}

/* INTEGRATOR */

export const QUERY_INTEGRATORS_HISTORY = (
    id: string,
    block: number,
) => `  integrator_${id.replace(
    /-/,
    "_",
)}: integrator(id: "${id}", block: { number: ${block} }) {
  id
  contractAddress

  txCount {
      symbol
      value
  }

  volume {
    symbol
    amount
    amountInEth
    amountInUsd
    asset {
      decimals
    }
  }

  locked {
    symbol
    amount
    amountInUsd
    asset {
      decimals
    }
  }
}`;

export interface Integrator {
    id: string; // "0x3973b2acdfac17171315e49ef19a0758b8b6f104";
    contractAddress: string; // "0x3973b2acdfac17171315e49ef19a0758b8b6f104";
    txCount: OrderedMap<TokenString, number>;
    locked: OrderedMap<TokenString, TokenAmount>;
    volume: OrderedMap<TokenString, TokenAmount>;
}

export interface IntegratorRaw {
    id: string; // "0x3973b2acdfac17171315e49ef19a0758b8b6f104";
    contractAddress: string; // "0x3973b2acdfac17171315e49ef19a0758b8b6f104";

    txCount: Array<{
        symbol: string;
        value: number;
    }>;

    locked: RawTokenAmount[];

    volume: RawTokenAmount[];
}

export const QUERY_INTEGRATORS = gql`
    query getIntegrators($offset: Int, $count: Int) {
        integrators(
            orderBy: volumeTotalUSD
            orderDirection: desc
            first: $count
            skip: $offset
            where: { date: 0 }
        ) {
            id
            contractAddress

            txCount {
                symbol
                value
            }

            volume {
                symbol
                amount
                amountInEth
                amountInUsd
                asset {
                    decimals
                }
            }

            locked {
                symbol
                amount
                amountInUsd
                asset {
                    decimals
                }
            }
        }
    }
`;
