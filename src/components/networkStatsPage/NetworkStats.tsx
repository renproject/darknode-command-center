import { useApolloClient } from "@apollo/react-hooks";
import { RenVMType } from "@renproject/interfaces";
import { CurrencyIcon, Loading } from "@renproject/react-components";
import BigNumber from "bignumber.js";
import { Map, OrderedMap } from "immutable";
import React, { useEffect, useState } from "react";

import { AllTokenDetails, OldToken, Token } from "../../lib/ethereum/tokens";
import {
    getVolumes, normalizeSeriesVolumes, PeriodResponse, PeriodResponses, PeriodType,
    QuotePeriodData, QuotePeriodResponse,
} from "../../lib/graphQL/volumes";
import { NetworkStateContainer } from "../../store/networkStateContainer";
import { ReactComponent as IconValueLocked } from "../../styles/images/icon-value-locked.svg";
import { ReactComponent as IconVolume } from "../../styles/images/icon-volume.svg";
import { Stat, Stats } from "../common/Stat";
import { Block, RenVMContainer } from "../renvmPage/renvmContainer";
import { Collateral } from "./Collateral";
import { HistoryChart } from "./HistoryChart";
import { PeriodSelector } from "./PeriodSelector";
import { StatTab, StatTabs } from "./StatTabs";
import { TokenChart } from "./TokenChart";

export const NetworkStats = () => {
    const client = useApolloClient();

    const { quoteCurrency, currentDarknodeCount, tokenPrices } = NetworkStateContainer.useContainer();
    const container = RenVMContainer.useContainer();

    useEffect(() => {
        container.updateBlocks().catch(console.error);
        const interval = setInterval(() => {
            container.updateBlocks().catch(console.error);
        }, 1000 * 7.5);
        return () => clearInterval(interval);
    }, []); // 7.5 seconds

    const firstBlock = container.blocks ? container.blocks.first<Block | null>(null) : null;

    // For each locked token, create a <Stat> element
    // tslint:disable-next-line: no-any
    let lockedBalances: OrderedMap<Token, BigNumber> = OrderedMap();
    let total = new BigNumber(0);
    if (firstBlock && firstBlock.prevState && firstBlock.prevState.map) {
        firstBlock.prevState
            // .map(state => { const { name, ...restOfA } = state; return { ...restOfA, name: state.name.replace("UTXOs", "").toUpperCase() as Token }; })
            .map((state) => {
                if (state.type === RenVMType.ExtTypeBtcCompatUTXOs) {
                    const token = state.name.replace("UTXOs", "").toUpperCase() as Token;
                    if (tokenPrices === null) {
                        lockedBalances = lockedBalances.set(token, new BigNumber(0));
                        return;
                    }

                    const tokenPriceMap = tokenPrices.get(token, undefined);
                    if (!tokenPriceMap) {
                        lockedBalances = lockedBalances.set(token, new BigNumber(0));
                        return;
                    }

                    const price = tokenPriceMap.get(quoteCurrency, undefined);
                    if (!price) {
                        lockedBalances = lockedBalances.set(token, new BigNumber(0));
                        return;
                    }

                    const tokenDetails = AllTokenDetails.get(token, undefined);
                    const decimals = tokenDetails ? new BigNumber(tokenDetails.decimals.toString()).toNumber() : 0;

                    const amount = new BigNumber(state && state.value ? state.value.reduce((sum, utxo) => sum.plus(utxo.amount || "0"), new BigNumber(0)).toFixed() : 0)
                        .div(new BigNumber(Math.pow(10, decimals)));

                    lockedBalances = lockedBalances.set(token, amount.times(price));
                    total = total.plus(lockedBalances.get(token, new BigNumber(0)));
                    return;
                }
            });
    }

    lockedBalances = lockedBalances.sortBy((_value, key) => Object.keys(Token).indexOf(key));

    let renPrice = 0;
    const renTokenPriceMap = tokenPrices && tokenPrices.get(OldToken.REN, undefined);
    renPrice = (renTokenPriceMap && renTokenPriceMap.get(quoteCurrency, undefined)) || 0;

    const r = new BigNumber(currentDarknodeCount || 0).times(100000).times(renPrice);

    const [volumePeriod, setVolumePeriod] = useState<PeriodType>(PeriodType.ALL);
    const [lockedPeriod, setLockedPeriod] = useState<PeriodType>(PeriodType.ALL);

    const [volumeTab, setVolumeTab] = useState<StatTab>(StatTab.History);
    const [lockedTab, setLockedTab] = useState<StatTab>(StatTab.DigitalAssets);

    // tslint:disable-next-line: prefer-const
    let [periodSeries, setPeriodSeries] = useState<Map<PeriodType, PeriodResponse | null | undefined>>(Map<PeriodType, PeriodResponse | null | undefined>());

    useEffect(() => {
        (async () => {
            for (const period of [volumePeriod, lockedPeriod]) {
                if (periodSeries.get(period) === undefined) {
                    periodSeries = periodSeries.set(period, null);
                    setPeriodSeries(periodSeries);

                    let response = undefined;
                    try {
                        response = await getVolumes(client, period);
                    } catch (error) {
                        console.error(error);
                    }

                    periodSeries = periodSeries.set(period, response);
                    setPeriodSeries(periodSeries);
                }
            }
        })().catch(console.error);
    }, [volumePeriod, lockedPeriod]);

    let [quotePeriodSeries, setQuotePeriodSeries] = useState<Map<PeriodType, QuotePeriodResponse>>(Map<PeriodType, QuotePeriodResponse>());
    useEffect(() => {
        for (const period of [PeriodType.DAY, PeriodType.HOUR, PeriodType.MONTH, PeriodType.WEEK, PeriodType.YEAR, PeriodType.ALL]) {
            const individualPeriodSeries = periodSeries.get(period);
            if (tokenPrices && individualPeriodSeries) {
                quotePeriodSeries = quotePeriodSeries.set(period, normalizeSeriesVolumes(individualPeriodSeries, tokenPrices, quoteCurrency));
                setQuotePeriodSeries(quotePeriodSeries);
            }
        }
    }, [periodSeries, tokenPrices, quoteCurrency]);


    return (
        <div className="network-stats container">
            <div className="col-lg-12 col-xl-8">
                <Stats>
                    <div className="stat-with-period">
                        <PeriodSelector selected={volumePeriod} onChange={setVolumePeriod} />
                        <Stat message={`Volume (${volumePeriod === PeriodType.ALL ? volumePeriod : `1${volumePeriod.slice(0, 1).toUpperCase()}`})`} icon={<IconVolume />} big className="stat--extra-big">
                            {quotePeriodSeries.get(volumePeriod) ? <><CurrencyIcon currency={quoteCurrency} />{quotePeriodSeries.get(volumePeriod)?.average.quotePeriodVolume}{/*<TokenBalance
                            token={Token.ETH}
                            convertTo={quoteCurrency}
                            amount={previousSummed}
                        />*/}</> : <Loading alt />}
                            <div className="overview--bottom">
                                <StatTabs selected={volumeTab} onChange={setVolumeTab} volumePeriod={volumePeriod} assetsPeriod={volumePeriod} />
                                {volumeTab === StatTab.History ?
                                    <HistoryChart graphType={"Volume"} periodSeries={quotePeriodSeries.get(volumePeriod)} /> :
                                    <TokenChart graphType={"Volume"} quoteCurrency={quoteCurrency} periodSeries={quotePeriodSeries.get(volumePeriod)} />
                                }
                            </div>
                        </Stat>
                    </div>
                    <div className="stat-with-period">
                        <PeriodSelector selected={lockedPeriod} onChange={setLockedPeriod} />
                        <Stat message="Value locked" icon={<IconValueLocked />} big className="stat--extra-big">
                            {quotePeriodSeries.get(lockedPeriod) ? <><CurrencyIcon currency={quoteCurrency} />{quotePeriodSeries.get(lockedPeriod)?.average.quoteTotalLocked}
                                {/* {total ? <> */}
                                {/* <CurrencyIcon currency={quoteCurrency} /> */}
                                {/* {total.toFormat(2)}{/*<TokenBalance */}
                                {/* token={Token.ETH} */}
                                {/* convertTo={quoteCurrency} */}
                                {/* amount={currentSummed} */}
                                {/* />*/}
                            </> : <Loading alt />}
                            <div className="overview--bottom">
                                <StatTabs selected={lockedTab} onChange={setLockedTab} volumePeriod={lockedPeriod} assetsPeriod={null} />
                                {lockedTab === StatTab.History ?
                                    <HistoryChart graphType={"Locked"} periodSeries={quotePeriodSeries.get(lockedPeriod)} /> :
                                    <TokenChart graphType={"Locked"} quoteCurrency={quoteCurrency} periodSeries={quotePeriodSeries.get(lockedPeriod)} />
                                }
                            </div>
                        </Stat>
                    </div>
                </Stats>
            </div>
            <div className="col-lg-12 col-xl-4">
                <Collateral l={total} r={r} rRen={new BigNumber(currentDarknodeCount || 0).times(100000)} />
            </div>
        </div>
    );
};
