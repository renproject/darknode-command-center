import { expect } from "chai";
import {
    bufferToUrlBase64,
    numberToLeftPaddedBase64String,
    sanitizeBase64String,
    stringTo43APaddedString,
} from "./encodingUtils";

describe("encoding utils", () => {
    test("sanitizeBase64String", () => {
        const result = sanitizeBase64String(
            "4nUltv8WR1cYvAkz-+=/-G0lHwAAAAAAAAAAAAAAAA=",
        );
        expect(result).to.equal("4nUltv8WR1cYvAkz--=_-G0lHwAAAAAAAAAAAAAAAA");
    });

    test("bufferToUrlBase64", () => {
        const result = bufferToUrlBase64(Buffer.from("0000abcdef"));
        expect(result).to.eql("MDAwMGFiY2RlZg");
    });

    test("numberToLeftPaddedBase64String number", () => {
        const result = numberToLeftPaddedBase64String(3500000);
        expect(result).to.eql("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1Z-A");
    });

    test("numberToLeftPaddedBase64String string", () => {
        const result = numberToLeftPaddedBase64String("3500000");
        expect(result).to.eql("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1Z-A");
    });

    test("pads string to 43 chars", () => {
        const result = stringTo43APaddedString("testnet");
        expect(result).to.eql("testnetAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    });
});
