import BigNumber from "bignumber.js";

export const fromBase64 = (base64: Buffer | string): Buffer => {
    return Buffer.isBuffer(base64) ? base64 : Buffer.from(base64, "base64");
};

export enum PackPrimitive {
    Bool = "bool",
    U8 = "u8",
    U16 = "u16",
    U32 = "u32",
    U64 = "u64",
    U128 = "u128",
    U256 = "u256",
    Str = "string",
    Bytes = "bytes",
    Bytes32 = "bytes32",
    Bytes65 = "bytes65",
}

export interface PackStructType {
    struct: Array<{ [name: string]: PackTypeDefinition }>;
}

export interface PackArrayType {
    list: PackTypeDefinition;
}

// Not implemented.
export type PackListType = never;

export type PackNilType = "nil";

export type PackType = PackPrimitive | PackNilType | "list" | "struct";

export type MarshalledPackArray<T> = Array<T>;
export type MarshalledPackStruct<T extends object> = T;

export type Marshalled<Type extends PackType> = Type extends PackPrimitive.Bool
    ? boolean
    : Type extends PackPrimitive.U8
    ? string
    : Type extends PackPrimitive.U16
    ? string
    : Type extends PackPrimitive.U32
    ? string
    : Type extends PackPrimitive.U64
    ? string
    : Type extends PackPrimitive.U128
    ? string
    : Type extends PackPrimitive.U256
    ? string
    : Type extends PackPrimitive.Str
    ? string
    : Type extends PackPrimitive.Bytes
    ? string
    : Type extends PackPrimitive.Bytes32
    ? string
    : Type extends PackPrimitive.Bytes65
    ? string
    : Type extends PackNilType
    ? string
    : Type extends "list"
    ? Array<any>
    : Type extends "struct"
    ? any
    : never;

export type Unmarshalled<
    Type extends PackType
> = Type extends PackPrimitive.Bool
    ? boolean
    : Type extends PackPrimitive.U8
    ? BigNumber
    : Type extends PackPrimitive.U16
    ? BigNumber
    : Type extends PackPrimitive.U32
    ? BigNumber
    : Type extends PackPrimitive.U64
    ? BigNumber
    : Type extends PackPrimitive.U128
    ? BigNumber
    : Type extends PackPrimitive.U256
    ? BigNumber
    : Type extends PackPrimitive.Str
    ? string
    : Type extends PackPrimitive.Bytes
    ? Buffer
    : Type extends PackPrimitive.Bytes32
    ? Buffer
    : Type extends PackPrimitive.Bytes65
    ? Buffer
    : Type extends PackNilType
    ? undefined
    : Type extends "list"
    ? Array<any>
    : Type extends "struct"
    ? any
    : never;

export type PackTypeDefinition =
    | PackPrimitive
    | PackStructType
    | PackListType
    | PackNilType;

export interface TypedPackValue<V = any> {
    t: PackTypeDefinition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    v: V;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const unmarshalPackPrimitive = (type: PackPrimitive, value: any) => {
    switch (type) {
        // Booleans
        case PackPrimitive.Bool:
            return value;
        // Integers
        case PackPrimitive.U8:
        case PackPrimitive.U16:
        case PackPrimitive.U32:
        case PackPrimitive.U64:
        case PackPrimitive.U128:
        case PackPrimitive.U256:
            return new BigNumber(value);
        // Strings
        case PackPrimitive.Str:
            return value;
        // Bytes
        case PackPrimitive.Bytes:
        case PackPrimitive.Bytes32:
        case PackPrimitive.Bytes65:
            return fromBase64(value);
    }
};

export const unmarshalPackStruct = (type: PackStructType, value: object) => {
    const struct = {};

    for (const member of type.struct) {
        const keys = Object.keys(member);
        if (keys.length === 0) {
            throw new Error(`Invalid struct member with no entries.`);
        }
        if (keys.length > 1) {
            throw new Error(`Invalid struct member with multiple entries.`);
        }
        const key = Object.keys(member)[0];
        const memberType = member[key];

        if (value && !value.hasOwnProperty(key)) {
            throw new Error(`Missing pack value for key ${key}.`);
        }

        struct[key] = unmarshalPackValue(memberType, value[key]);
    }

    return struct;
};

/**
 * Unmarshals a pack array.
 */
export const unmarshalPackArray = (
    type: PackArrayType,
    value: Array<any>,
): Array<any> => {
    return value.map((element) => unmarshalPackValue(type.list, element));
};

export const unmarshalPackValue = (
    type: PackTypeDefinition,
    value: unknown,
) => {
    if (Array.isArray(value)) {
        return unmarshalPackArray((type as any) as PackArrayType, value);
    } else if (typeof type === "object") {
        return unmarshalPackStruct(type, value as object);
    } else if (typeof type === "string") {
        if (type === "nil") return null;
        return unmarshalPackPrimitive(type, value);
    }
    throw new Error(
        `Unknown value type ${String(type)}${
            !type ? ` for value ${String(value)}` : ""
        }.`,
    );
};

export const unmarshalTypedPackValue = ({ t, v }: TypedPackValue) => {
    return unmarshalPackValue(t, v);
};
