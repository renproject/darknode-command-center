import * as React from "react";
import { EmptyDarknodeCard } from "./EmptyDarknodeCard";

export const EmptyDarknodeList = (): JSX.Element => <div className="background--darknode-list--outer">
    <div className="darknode-list background--darknode-list">
        <EmptyDarknodeCard />
        <EmptyDarknodeCard />
        <EmptyDarknodeCard />
        <EmptyDarknodeCard />
    </div>
</div>;