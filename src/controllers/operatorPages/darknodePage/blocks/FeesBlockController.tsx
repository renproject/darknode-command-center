import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
    DarknodeFeeStatus,
    RegistrationStatus,
} from "../../../../lib/ethereum/contractReads";
import { TokenString } from "../../../../lib/ethereum/tokens";
import { TokenAmount } from "../../../../lib/graphQL/queries/queries";
import { GraphContainer } from "../../../../store/graphContainer";
import {
    DarknodesState,
    NetworkContainer,
} from "../../../../store/networkContainer";
import { FeesBlock } from "./FeesBlock";
// import { ReactComponent as WithdrawIcon } from "../../../../styles/images/icon-withdraw.svg";

export const mergeFees = (
    left: OrderedMap<TokenString, TokenAmount | null>,
    right: OrderedMap<TokenString, TokenAmount | null>,
) => {
    let newFees = OrderedMap<TokenString, TokenAmount | null>();

    for (const token of left
        .keySeq()
        .concat(right.keySeq())
        .toSet()
        .toArray()) {
        const leftFee = left.get(token, null);
        const rightFee = right.get(token, null);
        const newFee: TokenAmount | null =
            leftFee || rightFee
                ? {
                      symbol:
                          (leftFee && leftFee.symbol) ||
                          (rightFee && rightFee.symbol) ||
                          "",
                      asset: (leftFee && leftFee.asset) ||
                          (rightFee && rightFee.asset) || { decimals: 0 },
                      amount: new BigNumber(0)
                          .plus(leftFee ? leftFee.amount : new BigNumber(0))
                          .plus(rightFee ? rightFee.amount : new BigNumber(0)),
                      amountInEth: new BigNumber(0)
                          .plus(
                              leftFee ? leftFee.amountInEth : new BigNumber(0),
                          )
                          .plus(
                              rightFee
                                  ? rightFee.amountInEth
                                  : new BigNumber(0),
                          ),
                      amountInUsd: new BigNumber(0)
                          .plus(
                              leftFee ? leftFee.amountInUsd : new BigNumber(0),
                          )
                          .plus(
                              rightFee
                                  ? rightFee.amountInUsd
                                  : new BigNumber(0),
                          ),
                  }
                : null;
        newFees = newFees.set(token, newFee);
    }
    return newFees;
};

export const FeesBlockController: React.FC<Props> = ({
    isOperator,
    darknodeDetails,
}) => {
    const {
        quoteCurrency,
        pendingRewards,
        pendingTotalInUsd,
    } = NetworkContainer.useContainer();
    const { renVM } = GraphContainer.useContainer();
    const { currentCycle, previousCycle } = renVM || {};

    const [disableClaim, setDisableClaim] = useState(false);

    const [currentCycleStatus, setCurrentCycleStatus] = useState<string | null>(
        null,
    );

    const cycleStatus: string | null = useMemo(
        () => darknodeDetails && darknodeDetails.cycleStatus.keySeq().first(),
        [darknodeDetails],
    );

    useEffect(() => {
        setCurrentCycleStatus(cycleStatus);
        if (disableClaim && cycleStatus !== currentCycleStatus) {
            setDisableClaim(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cycleStatus]);

    const showPreviousPending =
        previousCycle &&
        darknodeDetails &&
        darknodeDetails.cycleStatus.get(previousCycle) ===
            DarknodeFeeStatus.NOT_CLAIMED;
    const showCurrentPending =
        currentCycle &&
        darknodeDetails &&
        darknodeDetails.cycleStatus.get(currentCycle) ===
            DarknodeFeeStatus.NOT_CLAIMED;

    const cycleTotalInUsd = [
        showPreviousPending ? previousCycle : null,
        showCurrentPending ? currentCycle : null,
    ].reduce((acc, cycle) => {
        if (!cycle) {
            return acc;
        }
        const cycleFeesInUsd = pendingTotalInUsd.get(cycle, null);
        return cycleFeesInUsd
            ? (acc || new BigNumber(0)).plus(cycleFeesInUsd)
            : acc;
    }, null as BigNumber | null);

    let summedPendingRewards = OrderedMap<string, TokenAmount | null>();
    if (previousCycle && showPreviousPending) {
        // TODO(noah)
        summedPendingRewards = OrderedMap(); // pendingRewards.get(previousCycle, OrderedMap());
    }
    if (currentCycle && showCurrentPending) {
        summedPendingRewards = pendingRewards.get(currentCycle, OrderedMap());
    }
    if (
        previousCycle &&
        currentCycle &&
        showPreviousPending &&
        showCurrentPending
    ) {
        summedPendingRewards = mergeFees(
            // TODO(noah)
            // pendingRewards.get(previousCycle, OrderedMap()),
            OrderedMap(),
            pendingRewards.get(currentCycle, OrderedMap()),
        );
    }

    let withdrawable = darknodeDetails ? darknodeDetails.feesEarned : null;
    let withdrawableInUsd = darknodeDetails
        ? darknodeDetails.feesEarnedInUsd
        : null;
    let pending = summedPendingRewards;
    let pendingInUsd = cycleTotalInUsd;

    const earningFees: boolean =
        !!darknodeDetails &&
        (darknodeDetails.registrationStatus === RegistrationStatus.Registered ||
            darknodeDetails.registrationStatus ===
                RegistrationStatus.DeregistrationPending);

    const {
        withdrawReward,
        updateDarknodeDetails,
    } = NetworkContainer.useContainer();

    const withdrawCallback = useCallback(
        async (tokenSymbol: string, tokenAddress: string) => {
            if (!darknodeDetails) {
                return;
            }
            await withdrawReward(
                [darknodeDetails.ID],
                tokenSymbol,
                tokenAddress,
            );
            await updateDarknodeDetails(darknodeDetails.ID);
        },
        [darknodeDetails, withdrawReward, updateDarknodeDetails],
    );

    return (
        <FeesBlock
            quoteCurrency={quoteCurrency}
            isOperator={isOperator}
            earningFees={earningFees}
            withdrawable={withdrawable}
            withdrawableInUsd={withdrawableInUsd}
            pending={pending}
            pendingInUsd={pendingInUsd}
            withdrawCallback={withdrawCallback}
        />
    );
};

interface Props {
    isOperator: boolean;
    darknodeDetails: DarknodesState | null;
}
