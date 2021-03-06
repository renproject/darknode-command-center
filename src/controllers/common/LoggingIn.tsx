import React, { useCallback, useEffect } from "react";

import { catchBackgroundException } from "../../lib/react/errors";
import { Web3Container } from "../../store/web3Container";
import { EmptyDarknodeList } from "../../views/darknodeCards/EmptyDarknodeList";

/**
 * LoggingIn is shown when a user is required to log in to see the selected page.
 */
export const LoggingIn: React.FC<{}> = () => {
    const { address, promptLogin } = Web3Container.useContainer();

    const handleLogin = useCallback(async (): Promise<void> => {
        if (!address) {
            await promptLogin({ manual: false });
        }
    }, [promptLogin, address]);

    useEffect(() => {
        handleLogin().catch((error) =>
            catchBackgroundException(error, "Error in LoggingIn > handleLogin"),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="logging-in">
            <EmptyDarknodeList />
        </div>
    );
};
