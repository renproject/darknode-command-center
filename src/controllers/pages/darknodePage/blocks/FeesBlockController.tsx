import { Loading, sleep } from "@renproject/react-components";
import BigNumber from "bignumber.js";
import { OrderedMap } from "immutable";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    darknodeIDBase58ToRenVmID,
    darknodeIDHexToBase58,
} from "../../../../lib/darknode/darknodeID";
import {
    claimFees,
    ClaimFeesStatus,
    getClaimFeesStatus,
    getTransactionHash,
} from "../../../../lib/darknode/jsonrpc";
import {
    BlockState,
    toNativeTokenSymbol,
} from "../../../../lib/darknode/utils/blockStateUtils";
import {
    getNodeFeesCollection,
    getNodeLastNonceClaimed,
    getMinimumAmountForToken,
    getClaimFeeForToken,
} from "../../../../lib/darknode/utils/feesUtils";

import {
    DarknodeFeeStatus,
    RegistrationStatus,
} from "../../../../lib/ethereum/contractReads";
import { Token, TokenString } from "../../../../lib/ethereum/tokens";
import {
    base64StringToHexString,
    sanitizeBase64String,
} from "../../../../lib/general/encodingUtils";
import { TokenAmount } from "../../../../lib/graphQL/queries/queries";
import { classNames } from "../../../../lib/react/className";
import { claimFeesDigest } from "../../../../lib/web3/signatures";
import { GraphContainer } from "../../../../store/graphContainer";
import {
    DarknodesState,
    NetworkContainer,
} from "../../../../store/networkContainer";
import { NotificationsContainer } from "../../../../store/notificationsContainer";
import { PopupContainer } from "../../../../store/popupContainer";
import { Web3Container } from "../../../../store/web3Container";
import { ReactComponent as IconCheckCircle } from "../../../../styles/images/icon-check-circle.svg";
import { FeesBlock } from "../../../../views/darknodeBlocks/FeesBlock";
import { Popup } from "../../../common/popups/Popup";
import { updatePrices } from "../../../common/tokenBalanceUtils";
import Chains from "@renproject/chains";
import { ExternalLink } from "../../../../views/ExternalLink";
import { DEV_TOOLS } from "../../../../lib/react/environmentVariables";
import { EncodedData, Encodings } from "../../../../lib/general/encodedData";

const chainMap = {
    [Token.ETH]: Chains.Ethereum,
    [Token.REN]: Chains.Ethereum,
    [Token.BTC]: Chains.Bitcoin,
    [Token.ZEC]: Chains.Zcash,
    [Token.BCH]: Chains.BitcoinCash,
    [Token.FIL]: Chains.Filecoin,
    [Token.LUNA]: Chains.Terra,
    [Token.DOGE]: Chains.Dogecoin,
    [Token.DGB]: Chains.DigiByte,
};

const validateAddress = (token: string, address: string, network: string) => {
    const renNetwork = network as any;

    const chain = chainMap[token as Token];
    if (chain) {
        // We can't import the correct version of @renproject/interfaces, so for
        // now we cast the type.
        return (chain.utils.addressIsValid as (
            address: string,
            network?: string,
        ) => boolean)(address, renNetwork);
    }
    return true;
};

interface Props {
    isOperator: boolean;
    darknodeDetails: DarknodesState | null;
}

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
    const { quoteCurrency, pendingRewards } = NetworkContainer.useContainer();
    const { renVM, subgraphOutOfSync } = GraphContainer.useContainer();
    // const { setPopup, clearPopup } = PopupContainer.useContainer();
    const { currentCycle, previousCycle } = renVM || {};
    // const {
    //     claimWarningShown,
    //     setClaimWarningShown,
    // } = UIContainer.useContainer();

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
            DarknodeFeeStatus.NOT_CLAIMED &&
        !subgraphOutOfSync;
    const showCurrentPending =
        currentCycle &&
        darknodeDetails &&
        darknodeDetails.cycleStatus.get(currentCycle) ===
            DarknodeFeeStatus.NOT_CLAIMED;

    const earningFees: boolean =
        !!darknodeDetails &&
        darknodeDetails.registrationStatus === RegistrationStatus.Registered;

    const canWithdraw: boolean =
        !!darknodeDetails &&
        (darknodeDetails.registrationStatus === RegistrationStatus.Registered ||
            darknodeDetails.registrationStatus ===
                RegistrationStatus.DeregistrationPending);

    // useEffect(() => {
    //     // If the darknode hasn't claimed within 1 day of a new epoch, show a
    //     // warning popup.
    //     const day = moment.duration(5, "hours").asSeconds();
    //     if (
    //         isOperator &&
    //         !claimWarningShown &&
    //         showPreviousPending &&
    //         earningFees &&
    //         timeSinceLastEpoch &&
    //         timeSinceLastEpoch.gt(day)
    //     ) {
    //         setClaimWarningShown(true);
    //         setPopup({
    //             popup: <NotClaimed onCancel={clearPopup} />,
    //             onCancel: clearPopup,
    //             dismissible: true,
    //             overlay: true,
    //         });
    //     }
    // }, [
    //     showPreviousPending,
    //     timeSinceLastEpoch,
    //     claimWarningShown,
    //     setClaimWarningShown,
    //     clearPopup,
    //     setPopup,
    //     earningFees,
    //     isOperator,
    // ]);

    let summedPendingRewards = OrderedMap<string, TokenAmount | null>();
    if (previousCycle && showPreviousPending) {
        pendingRewards.get(previousCycle, OrderedMap());
        // summedPendingRewards = OrderedMap();
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
            pendingRewards.get(previousCycle, OrderedMap()),
            pendingRewards.get(currentCycle, OrderedMap()),
        );
    }

    // TODO: fees here are being splitted to withdrawable / pending
    const withdrawable = darknodeDetails ? darknodeDetails.feesEarned : null;
    const pending = summedPendingRewards;

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
            canWithdraw={canWithdraw}
            withdrawable={withdrawable}
            pending={pending}
            withdrawCallback={withdrawCallback}
        />
    );
};

const convertToNativeAmount = (
    value: BigNumber | string,
    decimals: number,
): BigNumber =>
    new BigNumber(value).multipliedBy(
        new BigNumber(Math.pow(10, decimals || 0)),
    );

const convertToAmount = (
    value: BigNumber | string,
    decimals: number,
    decimalsPlaces?: number,
): string => {
    let amount = new BigNumber(value).div(
        new BigNumber(Math.pow(10, decimals || 0)),
    );

    if (decimalsPlaces !== undefined) {
        amount = amount.decimalPlaces(decimalsPlaces, BigNumber.ROUND_CEIL);
    }

    return amount.toFixed();
};

enum FeeWithdrawalStage {
    Configuration = "configuration",
    Confirmation = "confirmation",
    Processing = "processing",
}

export const RenVmFeesBlockController: React.FC<Props> = ({
    isOperator,
    darknodeDetails,
}) => {
    const { updateDarknodeDetails } = NetworkContainer.useContainer();
    const {
        address: signingAddress,
        web3,
        renNetwork,
    } = Web3Container.useContainer();
    const { showPending } = NotificationsContainer.useContainer();

    const network = renNetwork.name;
    const {
        blockState,
        quoteCurrency,
        tokenPrices,
        fetchBlockState,
    } = NetworkContainer.useContainer();

    const { setOverlay } = PopupContainer.useContainer();

    const renVmDarknodeId = darknodeIDBase58ToRenVmID(
        darknodeIDHexToBase58(darknodeDetails?.ID || ""),
    );

    const withdrawableFees =
        darknodeDetails?.renVmFeesEarned ||
        updatePrices(
            getNodeFeesCollection(renVmDarknodeId, blockState, "claimable"),
            tokenPrices,
        );

    const pendingFees =
        darknodeDetails?.renVmFeesPending ||
        updatePrices(
            getNodeFeesCollection(renVmDarknodeId, blockState, "pending"),
            tokenPrices,
        );

    const [token, setToken] = useState("");
    const nativeTokenSymbol = toNativeTokenSymbol(token);
    const lastNonce =
        blockState !== null
            ? getNodeLastNonceClaimed(
                  renVmDarknodeId,
                  nativeTokenSymbol,
                  blockState,
              )
            : null;
    const [open, setOpen] = useState(false);
    const [error, setError] = useState("");
    const [amount, setAmount] = useState(new BigNumber(0));
    const [inputAmount, setInputAmount] = useState("0");
    const [amountError, setAmountError] = useState("");
    const [address, setAddress] = useState("");
    const [addressError, setAddressError] = useState("");
    const [pending, setPending] = useState(false);
    const [renVMHash, setRenVMHash] = useState<string | null>(null);
    const tokenAmount = withdrawableFees.find(
        (entry) => entry?.symbol === token,
    );
    const maxAmount: BigNumber = useMemo(
        () =>
            tokenAmount?.amount.integerValue(BigNumber.ROUND_DOWN) ||
            new BigNumber(0),
        [tokenAmount?.amount],
    );
    useEffect(() => {
        setAmount(maxAmount);
        setInputAmount(
            convertToAmount(maxAmount, tokenAmount?.asset?.decimals || 0),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tokenAmount?.asset?.decimals, maxAmount.toFixed(), setInputAmount]);

    const minAmount = blockState
        ? getMinimumAmountForToken(nativeTokenSymbol, blockState)
        : null;

    const claimFee = blockState
        ? getClaimFeeForToken(nativeTokenSymbol, blockState)
        : null;
    const claimFeeReadable = claimFee
        ? convertToAmount(claimFee, tokenAmount?.asset?.decimals || 0, 6)
        : null;

    const amountAfterFees = claimFee
        ? BigNumber.max(amount.minus(claimFee), new BigNumber(0))
        : amount;
    const amountAfterFeesReadable = convertToAmount(
        amountAfterFees,
        tokenAmount?.asset?.decimals || 0,
    );

    const handleOpen = useCallback(() => {
        setOverlay(true);
        setOpen(true);
    }, [setOverlay]);

    const handleClose = useCallback(() => {
        setOpen(false);
        setOverlay(false);
        setPending(false);
        setError("");
        setAmount(new BigNumber(0));
        setAddress("");
        setAmountError("");
        setAddressError("");
        setToken("");
        setStage(FeeWithdrawalStage.Configuration);
        setRenVMHash(null);

        (async () => {
            await fetchBlockState();
            if (darknodeDetails) {
                await updateDarknodeDetails(darknodeDetails.ID);
            }
        })().catch(console.error);
    }, [setOverlay, darknodeDetails, fetchBlockState, updateDarknodeDetails]);

    const handleAddressChange = useCallback(
        (event) => {
            const newAddress = event.target.value;
            setAddress(newAddress);
            // Clear any errors.
            setAddressError("");
        },
        [setAddress, setAddressError],
    );
    const destinationAddress = address;

    const handleAmountChange = useCallback(
        (event) => {
            const value = event.target.value;
            setInputAmount(value);
            const newNativeAmount = convertToNativeAmount(
                value,
                tokenAmount?.asset?.decimals || 0,
            );
            setAmount(newNativeAmount);

            if (newNativeAmount.isNaN() || newNativeAmount.isNegative()) {
                setAmountError("Invalid amount.");
            } else if (newNativeAmount.isGreaterThan(maxAmount)) {
                setAmountError("Amount exceeds claimable fee.");
            } else if (newNativeAmount.isZero()) {
                setAmountError("Please enter amount.");
            } else if (newNativeAmount.decimalPlaces() > 0) {
                setAmountError("Too many decimals.");
            } else if (
                minAmount &&
                newNativeAmount.isLessThanOrEqualTo(minAmount)
            ) {
                const minimum = convertToAmount(
                    minAmount,
                    tokenAmount?.asset?.decimals || 0,
                );
                setAmountError(
                    `Must withdraw at least ${minimum} ${nativeTokenSymbol}.`,
                );
            } else {
                setAmountError("");
            }
        },
        [maxAmount, tokenAmount?.asset?.decimals, minAmount, nativeTokenSymbol],
    );

    const withdrawCallback = useCallback(
        // eslint-disable-next-line @typescript-eslint/require-await
        async (tokenSymbol: string) => {
            if (!open) {
                setToken(tokenSymbol);
                handleOpen();
            }
        },
        [open, handleOpen],
    );

    const [stage, setStage] = useState<FeeWithdrawalStage>(
        FeeWithdrawalStage.Configuration,
    );

    const handleContinue = useCallback(async () => {
        if (!validateAddress(nativeTokenSymbol, address, renNetwork.name)) {
            setAddressError("Address is invalid.");
            return;
        } else if (!address) {
            setAddressError("Please enter an address.");
            return;
        } else if (!amount) {
            setAmountError("Please enter an amount.");
            return;
        }

        if (stage === FeeWithdrawalStage.Configuration) {
            if (!amountError && !addressError) {
                setStage(FeeWithdrawalStage.Confirmation);
            }
        } else if (stage === FeeWithdrawalStage.Confirmation) {
            if (!darknodeDetails?.ID || !signingAddress || lastNonce === null) {
                return;
            }
            const nonce = lastNonce + 1;
            const base64Digest = claimFeesDigest(
                nativeTokenSymbol,
                network,
                renVmDarknodeId,
                amount,
                destinationAddress,
                nonce,
            );
            const hexDigest = base64StringToHexString(base64Digest);
            setPending(true);
            const hexSignature = await web3.eth.personal
                .sign(hexDigest, signingAddress, "")
                .finally(() => {
                    setPending(false);
                });
            setPending(true);
            const signatureBuffer = new EncodedData(
                hexSignature,
                Encodings.HEX,
            ).toBuffer();
            if (signatureBuffer.length < 65) {
                throw new Error(
                    "Invalid signature returned from Web3 provider.",
                );
            }
            // Ensure that signature recovery ID is either 27 or 28.
            if (signatureBuffer[64] < 27) {
                signatureBuffer[64] += 27;
            }
            const signature = sanitizeBase64String(
                signatureBuffer.toString("base64"),
            );
            let dismissNotification: (() => void) | undefined;
            try {
                const renVMHash = getTransactionHash(
                    renNetwork,
                    token,
                    renVmDarknodeId,
                    amount,
                    destinationAddress,
                    nonce,
                    signature,
                );
                const response = await claimFees(
                    renNetwork,
                    token,
                    renVmDarknodeId,
                    amount,
                    destinationAddress,
                    nonce,
                    signature,
                );
                if (response.status === 200) {
                    const { update, dismiss } = showPending(
                        `Withdrawing ${amountAfterFeesReadable} ${nativeTokenSymbol}.`,
                    );
                    dismissNotification = dismiss;
                    setRenVMHash(renVMHash);
                    setStage(FeeWithdrawalStage.Processing);

                    // Wait until the transaction is done - re-fetching the
                    // status every 5 seconds.
                    while (true) {
                        try {
                            const { status, revert } = await getClaimFeesStatus(
                                renNetwork,
                                renVMHash,
                            );
                            if (revert) {
                                setPending(false);
                                setStage(FeeWithdrawalStage.Configuration);
                                setError(`Withdraw failed - ${revert}`);

                                update({
                                    type: "error",
                                    message: `${nativeTokenSymbol} withdrawal failed.`,
                                });
                                return;
                            } else if (status === ClaimFeesStatus.Done) {
                                break;
                            }
                        } catch (error) {
                            console.error(error);
                        }
                        await sleep(5 * 1000);
                    }

                    setPending(false);
                    update({
                        type: "success",
                        message: `Withdrew ${amountAfterFeesReadable} ${nativeTokenSymbol}!`,
                        autoDismiss: 10 * 1000,
                    });

                    try {
                        await fetchBlockState();
                        await updateDarknodeDetails(darknodeDetails.ID);
                    } catch (error) {
                        console.error(error);
                    }
                }
            } catch (err) {
                console.error("Withdraw error:", err, err?.response);
                console.error(err?.data?.error?.message);
                setPending(false);
                if (dismissNotification) {
                    dismissNotification();
                }
                setStage(FeeWithdrawalStage.Configuration);
                setError("Withdraw failed.");
                if (
                    (err?.response?.data?.error?.message || "").includes(
                        "bad to",
                    )
                ) {
                    setAddressError(
                        "Address rejected by RenVM. Please try another address.",
                    );
                } else if (err?.response?.data?.error?.message) {
                    setError(
                        `Withdraw failed (${err?.response?.data?.error?.message})`,
                    );
                }
            }
        }
    }, [
        address,
        amount,
        web3,
        network,
        signingAddress,
        destinationAddress,
        renVmDarknodeId,
        token,
        darknodeDetails?.ID,
        renNetwork,
        stage,
        addressError,
        amountError,
        nativeTokenSymbol,
        lastNonce,
        amountAfterFeesReadable,
        showPending,
        fetchBlockState,
        updateDarknodeDetails,
    ]);

    const handlePrev = useCallback(() => {
        if (stage === FeeWithdrawalStage.Confirmation) {
            setStage(FeeWithdrawalStage.Configuration);
        }
    }, [stage]);

    const canWithdraw =
        darknodeDetails?.registrationStatus === RegistrationStatus.Registered ||
        darknodeDetails?.registrationStatus ===
            RegistrationStatus.DeregistrationPending;

    const earningFees =
        darknodeDetails?.registrationStatus === RegistrationStatus.Registered;

    const amountBN = new BigNumber(amount || 0).div(
        new BigNumber(Math.pow(10, tokenAmount?.asset?.decimals || 0)),
    );
    return (
        <>
            <FeesBlock
                quoteCurrency={quoteCurrency}
                isOperator={isOperator}
                earningFees={earningFees}
                canWithdraw={canWithdraw}
                withdrawable={withdrawableFees}
                pending={pendingFees}
                withdrawCallback={withdrawCallback}
                isRenVMFee={true}
                blockState={blockState as BlockState}
            />
            {open && (
                <div className="popup--container">
                    <div className="popup-backdrop--blur" />
                    <Popup
                        onCancel={handleClose}
                        className="popup--padded-medium popup--size-medium popup--align-left"
                    >
                        <div>
                            <h1>Withdraw earnings</h1>
                            <h2>for {nativeTokenSymbol}</h2>
                        </div>
                        <div className="popup--content popup--content--medium-height">
                            {stage === "configuration" && (
                                <>
                                    <div className="field-wrapper">
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <label className="field-label">
                                                Amount
                                            </label>
                                            {claimFeeReadable ? (
                                                <div
                                                    className="field-label"
                                                    style={{ opacity: 0.8 }}
                                                >
                                                    Transaction fee:{" "}
                                                    {claimFeeReadable}{" "}
                                                    {nativeTokenSymbol}
                                                </div>
                                            ) : null}
                                        </div>
                                        <input
                                            type="text"
                                            className="field-input field-input--full-width"
                                            onChange={handleAmountChange}
                                            value={inputAmount}
                                        />

                                        {/* <div className="field-info field-info--supplemental field-info--flex">
                                            <span>Native amount:</span>
                                            <span>{amount}</span>
                                        </div> */}
                                        <div className="field-info">
                                            <div>
                                                This is the amount you will
                                                withdraw
                                            </div>
                                        </div>
                                        {Boolean(amountError) && (
                                            <div className="field-error">
                                                {amountError}
                                            </div>
                                        )}
                                    </div>
                                    <div className="field-wrapper">
                                        <label className="field-label">
                                            Wallet address
                                        </label>
                                        <input
                                            type="text"
                                            className="field-input field-input--full-width"
                                            placeholder="Enter address here"
                                            onChange={handleAddressChange}
                                            value={address}
                                        />
                                        <div className="field-info">
                                            This address is where you will
                                            receive your rewards
                                        </div>
                                        {Boolean(addressError) && (
                                            <div className="field-error">
                                                {addressError}
                                            </div>
                                        )}
                                    </div>
                                    {Boolean(error) && (
                                        <div className="form-error-wrapper">
                                            <h2 className="form-error-header">
                                                Error
                                            </h2>
                                            <p className="form-error-text">
                                                {error}
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}
                            {stage === "confirmation" && (
                                <>
                                    <div className="field-wrapper">
                                        <p>You are about to send</p>
                                        <p className="fee-confirmation-data">
                                            {amountAfterFeesReadable}{" "}
                                            {nativeTokenSymbol}
                                        </p>
                                    </div>
                                    <div className="field-wrapper">
                                        <p>To the following address:</p>
                                        <p className="fee-confirmation-data">
                                            {address}
                                        </p>
                                    </div>
                                    <div className="field-wrapper">
                                        <p className="field-info--supplemental">
                                            Please double check that the wallet
                                            you are sending to is compatible
                                            with the tokens that are being sent.{" "}
                                            <br />
                                            Sending tokens to an incompatible
                                            wallet or a wrong address will
                                            result in funds becoming
                                            unrecoverable.
                                        </p>
                                    </div>
                                </>
                            )}
                            {stage === "processing" && (
                                <>
                                    <div className="fee-withdrawal-status">
                                        {pending ? (
                                            <>
                                                <Loading className="loading--big fee-withdrawal-icon" />
                                                <span className="field-info--supplemental">
                                                    {renVMHash ? (
                                                        <>Withdrawing</>
                                                    ) : (
                                                        <>
                                                            Initiating
                                                            withdrawal
                                                        </>
                                                    )}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <IconCheckCircle
                                                    className="fee-withdrawal-icon"
                                                    width={60}
                                                    height={60}
                                                />
                                                <span className="collateral-status--over">
                                                    Withdraw complete
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div className="field-wrapper">
                                        {pending ? (
                                            <p className="field-info--supplemental">
                                                {renVMHash ? (
                                                    <>
                                                        RenVM is processing your
                                                        withdrawal request.{" "}
                                                        <br />
                                                        This can take a few
                                                        minutes.
                                                    </>
                                                ) : (
                                                    <>
                                                        Initiating withdrawal
                                                        transaction. Please wait
                                                        a moment.
                                                    </>
                                                )}
                                            </p>
                                        ) : (
                                            <p className="field-info--supplemental">
                                                Depending on network conditions,
                                                it may take up to a few hours
                                                for the transaction to be
                                                confirmed.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="popup--buttons">
                            {Boolean(renVMHash) && (
                                <ExternalLink
                                    className="button button--alt"
                                    href={`${DEV_TOOLS}/tx/${renVMHash}`}
                                >
                                    See transaction status. →
                                </ExternalLink>
                            )}
                            {stage === "configuration" && (
                                <button
                                    className="button button--white"
                                    onClick={handleClose}
                                >
                                    Cancel
                                </button>
                            )}
                            {stage === "confirmation" && (
                                <button
                                    className="button button--white"
                                    onClick={handlePrev}
                                >
                                    Back
                                </button>
                            )}
                            {stage === "configuration" && (
                                <button
                                    className="button"
                                    onClick={handleContinue}
                                    disabled={
                                        !Boolean(amount) ||
                                        Boolean(amountError) ||
                                        !Boolean(address) ||
                                        Boolean(addressError)
                                    }
                                >
                                    Continue
                                </button>
                            )}
                            {stage === "confirmation" && (
                                <button
                                    disabled={pending}
                                    className="button"
                                    onClick={handleContinue}
                                >
                                    {pending ? (
                                        <>
                                            Waiting for signature{" "}
                                            <Loading
                                                className="status--button--spinner"
                                                alt
                                            />
                                        </>
                                    ) : (
                                        <>Confirm & Send</>
                                    )}
                                </button>
                            )}
                            {stage === "processing" && (
                                <button
                                    className="button"
                                    onClick={handleClose}
                                    disabled={pending}
                                >
                                    Done
                                </button>
                            )}
                        </div>
                    </Popup>
                </div>
            )}
        </>
    );
};

type FeesSource = "eth" | "renvm";

export const FeesSwitcherController: React.FC<Props> = ({
    isOperator,
    darknodeDetails,
}) => {
    const [source, setSource] = useState<FeesSource>("renvm");
    return (
        <div className="fees-switcher">
            <div className="fees-switcher--control">
                {["eth", "renvm"].map((symbol) => (
                    <span key={symbol}>
                        <span
                            className={classNames(
                                "fees-switcher--button",
                                source === symbol
                                    ? "fees-switcher--button--active"
                                    : "",
                            )}
                            onClick={() => {
                                setSource(symbol as FeesSource);
                            }}
                        >
                            {symbol === "eth" ? "Ethereum" : "RenVM"}
                        </span>
                        {symbol === "eth" && (
                            <span className="fees-switcher--divider">|</span>
                        )}
                    </span>
                ))}
            </div>
            {source === "eth" && (
                <FeesBlockController
                    isOperator={isOperator}
                    darknodeDetails={darknodeDetails}
                />
            )}
            {source === "renvm" && (
                <RenVmFeesBlockController
                    isOperator={isOperator}
                    darknodeDetails={darknodeDetails}
                />
            )}
        </div>
    );
};
