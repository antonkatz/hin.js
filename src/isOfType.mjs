import {HINGES_FACTORY_PROP} from "./consts.mjs";

export function isOfType(T, ofType) {
    if (!T[HINGES_FACTORY_PROP]) return false

    return !!T[HINGES_FACTORY_PROP][ofType] || false
}