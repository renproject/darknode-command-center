import { List } from "immutable";
import { ActionType, getType } from "typesafe-actions";

import * as networkActions from "../../actions/statistics/networkActions";
import * as operatorActions from "../../actions/statistics/operatorActions";

import { StatisticsData } from "../../reducers/types";

type NetworkAction = ActionType<typeof networkActions>;
type OperatorActions = ActionType<typeof operatorActions>;

export function statisticsReducer(
    state: StatisticsData = new StatisticsData(),
    action: NetworkAction | OperatorActions
) {
    switch (action.type) {
        case getType(networkActions.storeMinimumBond):
            return state.set("minimumBond", action.payload.minimumBond);

        case getType(networkActions.storeTokenPrices):
            return state.set("tokenPrices", action.payload.tokenPrices);

        case getType(operatorActions.addRegisteringDarknode):
            return state.set("darknodeRegisteringList", state.darknodeRegisteringList.set(
                action.payload.darknodeID,
                action.payload.publicKey
            ));

        case getType(operatorActions.storeDarknodeList):
            let newList = state.darknodeList.get(action.payload.address) || List();
            let newNames = state.darknodeNames;

            // Add to list if it's not already in there (this is an inefficient
            // process but it's only run on a small number of strings every two minutes)
            action.payload.darknodeList.map((darknodeID) => {
                if (!newList.contains(darknodeID)) {
                    newList = newList.push(darknodeID);

                    // if (!newNames.has(darknodeID)) {
                    //     newNames = newNames.set(darknodeID, `Darknode ${newList.indexOf(darknodeID) + 1}`);
                    // }
                }
            });

            newList.map((darknodeID) => {
                if (!newNames.has(darknodeID)) {
                    newNames = newNames.set(darknodeID, `Darknode ${newList.indexOf(darknodeID) + 1}`);
                }
            });

            const darknodeRegisteringList = state.darknodeRegisteringList
                .filter((_, darknodeID) => !newList.contains(darknodeID));

            return state
                .set("darknodeList", state.darknodeList.set(action.payload.address, newList))
                .set("darknodeNames", newNames)
                .set("darknodeRegisteringList", darknodeRegisteringList);

        case getType(operatorActions.storeQuoteCurrency):
            return state.set("quoteCurrency", action.payload.quoteCurrency);

        case getType(operatorActions.updateDarknodeHistory):
            return state.set("balanceHistories", state.balanceHistories.set(
                action.payload.darknodeID,
                action.payload.balanceHistory,
            ));

        case getType(operatorActions.storeSecondsPerBlock):
            return state.set("secondsPerBlock", action.payload.secondsPerBlock);

        case getType(operatorActions.setDarknodeDetails):
            const details = action.payload.darknodeDetails;
            return state.set("darknodeDetails", state.darknodeDetails.set(
                details.ID,
                action.payload.darknodeDetails,
            ));

        case getType(operatorActions.setDarknodeName):
            return state.set("darknodeNames", state.darknodeNames.set(action.payload.darknodeID, action.payload.name));

        default:
            return state;
    }
}
