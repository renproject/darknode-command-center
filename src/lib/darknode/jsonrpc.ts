import { Record } from "@renproject/react-components";
import Axios from "axios";

import {
    retryNTimes,
    RPCResponse,
} from "../../controllers/pages/renvmStatsPage/renvmContainer";
import { DEFAULT_REQUEST_TIMEOUT } from "../react/environmentVariables";

interface ResponseQueryStat {
    version: string;
    multiAddress: string;
    cpus: Array<{
        cores: number;
        clockRate: number;
        cacheSize: number;
        modelName: string;
    }>;
    memory: number;
    memoryUsed: number;
    memoryFree: number;
    disk: number;
    diskUsed: number;
    diskFree: number;
    systemUptime: number;
    serviceUptime: number;
}

export class NodeStatistics extends Record({
    version: "",
    multiAddress: "",
    memory: 0,
    memoryUsed: 0,
    memoryFree: 0,
    disk: 0,
    diskUsed: 0,
    diskFree: 0,
    systemUptime: 0,
    serviceUptime: 0,

    cores: 0,
}) {}

export const queryStat = async (lightnode: string, darknodeID: string) => {
    const request = {
        jsonrpc: "2.0",
        method: "ren_queryStat",
        params: {},
        id: 67,
    };
    const result = (
        await retryNTimes(
            async () =>
                await Axios.post<RPCResponse<ResponseQueryStat>>(
                    `${lightnode}?id=${darknodeID}`,
                    request,
                    { timeout: DEFAULT_REQUEST_TIMEOUT },
                ),
            2,
        )
    ).data.result;
    return new NodeStatistics({
        version: result.version,
        multiAddress: result.multiAddress,
        memory: result.memory,
        memoryUsed: result.memoryUsed,
        memoryFree: result.memoryFree,
        disk: result.disk,
        diskUsed: result.diskUsed,
        diskFree: result.diskFree,
        systemUptime: result.systemUptime,
        serviceUptime: result.serviceUptime,
        cores: result.cpus.reduce((sum, cpu) => sum + cpu.cores, 0),
    });
};

export interface RenVMState {
    state: {
        [chain: string]: {
            address: string; // "19iqYbeATe4RxghQZJnYVFU4mjUUu76EA6";
            dust: string; // "546";
            gasCap: string; // "68";
            gasLimit: string; // "400";
            gasPrice: string; // "68";
            latestChainHash: string; // "";
            latestChainHeight: string; // "687159";
            minimumAmount: string; // "547";
            output?: {
                outpoint: {
                    hash: string; // "X8rTxRtVMBPJeOp3n5O7lvtzwL5CpP2wOBXfvw2JrpQ";
                    index: string; // "1";
                };
                pubKeyScript: string; // "dqkUX6qVduRay8lmK2q_MjIpt0ipSV2IrA";
                value: string; // "1103287860496";
            };
            pubKey: string; // "A6Auk8-MR7JQB1sK9h-W69EDdsCqp2NRSOiJyytRyWkn";
        };
    };
}

export const queryState = async (lightnode: string): Promise<RenVMState> => {
    const request = {
        jsonrpc: "2.0",
        method: "ren_queryState",
        params: {},
        id: 67,
    };
    const result = (
        await retryNTimes(
            async () =>
                await Axios.post<RPCResponse<RenVMState>>(lightnode, request, {
                    timeout: DEFAULT_REQUEST_TIMEOUT,
                }),
            2,
        )
    ).data.result;
    return result;
};
