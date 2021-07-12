import { faBars } from "@fortawesome/free-solid-svg-icons";
import {
    FontAwesomeIcon,
    FontAwesomeIconProps,
} from "@fortawesome/react-fontawesome";
import {
    currencies,
    Currency,
    CurrencyIcon,
    Dropdown,
} from "@renproject/react-components";
import React from "react";
import { Link, useLocation } from "react-router-dom";

import { classNames } from "../../../lib/react/className";
import { NODE_ENV } from "../../../lib/react/environmentVariables";
import { NetworkContainer } from "../../../store/networkContainer";
import { UIContainer } from "../../../store/uiContainer";
import { Web3Container } from "../../../store/web3Container";
import { ReactComponent as IntegratorsIcon } from "../../../styles/images/icon-integrators.svg";
import { ReactComponent as NetworkIcon } from "../../../styles/images/icon-network.svg";
import { ReactComponent as OverviewIcon } from "../../../styles/images/Icon-Overview.svg";
import { StatusDot, StatusDotColor } from "../../../views/StatusDot";
import { AccountDropdown } from "./AccountDropdown";
import { MoreDropdown } from "./MoreDropdown";
import { NewsBanner } from "./NewsBanner";

const getCurrencyOptions = () => {
    const options = new Map<string, React.ReactNode>();

    for (const currency of currencies) {
        options.set(
            currency.currency,
            <>
                <CurrencyIcon currency={currency.currency} />{" "}
                {currency.description}
            </>,
        );
    }

    return options;
};

const currencyOptions = getCurrencyOptions();

const MenuItem: React.FC<{
    path: string;
    title: string;
    icon: JSX.Element;
    activePath: string;
}> = ({ path, title, icon, activePath }) => (
    <Link className="no-underline" to={path}>
        <li
            className={classNames(
                "header--group",
                activePath && activePath.split("/")[1] === path.split("/")[1]
                    ? "header--group--active"
                    : "",
            )}
        >
            <div className="header--selected">
                {icon} <div>{title}</div>
            </div>
        </li>
    </Link>
);

/**
 * Header is a visual component providing page branding and navigation.
 */
export const Header = () => {
    const location = useLocation();

    const { showMobileMenu } = UIContainer.useContainer();
    const { renNetwork } = Web3Container.useContainer();
    const { quoteCurrency, setQuoteCurrency } = NetworkContainer.useContainer();

    const setCurrency = (currency: string): void => {
        setQuoteCurrency(currency as Currency);
    };

    const currencyDropdownNode = (
        <Dropdown
            key="currencyDropdown"
            selected={{
                value: quoteCurrency,
                render: (
                    <>
                        <CurrencyIcon currency={quoteCurrency} />{" "}
                        {quoteCurrency.toUpperCase()}
                    </>
                ),
            }}
            options={currencyOptions}
            setValue={setCurrency}
        />
    );

    return (
        <div className="header">
            <Link className="no-underline" to="/">
                <div className="header--logo" />
            </Link>
            {renNetwork.name === "mainnet" ? (
            <>
                <div className="header--news">
                    <NewsBanner />
                </div>
            </>
            ) : (
                <div className="new">
                    <div className="header--network">
                        <StatusDot color={StatusDotColor.Yellow} size={16} />{" "}
                        <span className="header--network--text">
                            {renNetwork.name.toUpperCase()}
                        </span>
                    </div>
                </div>
            )}
            <div className="header--menu">
                <MenuItem
                    path="/"
                    title="Network"
                    icon={<NetworkIcon />}
                    activePath={location.pathname}
                />
                <MenuItem
                    path="/integrators"
                    title="Integrators"
                    icon={<IntegratorsIcon />}
                    activePath={location.pathname}
                />
                <MenuItem
                    path="/darknodes"
                    title="Darknodes"
                    icon={<OverviewIcon />}
                    activePath={location.pathname}
                />
                {/* <MenuItem
                    path="/renvm"
                    title="RenVM"
                    icon={<RenVMIcon />}
                    activePath={location.pathname}
                /> */}

                {NODE_ENV === "development" ? (
                    <MenuItem
                        path="/catalog"
                        title="Catalog"
                        icon={<OverviewIcon />}
                        activePath={location.pathname}
                    />
                ) : null}

                {/* {languageDropdownNode} */}
                {currencyDropdownNode}
                {/* {networkDropdownNode} */}
                <MoreDropdown />
                <AccountDropdown />
            </div>
            <div role="button" className="header--mobile-menu--button">
                <button onClick={showMobileMenu}>
                    <FontAwesomeIcon
                        icon={faBars as FontAwesomeIconProps["icon"]}
                    />
                </button>
            </div>
        </div>
    );
};
