import {isOfType} from "./isOfType.mjs";

import {HINGES_PARENT_PROP} from "./consts.mjs";

export function findAncestor(T, ofType, doNotThrow) {
  const p = T?.[HINGES_PARENT_PROP]
  if (p != undefined) {
    if (isOfType(p, ofType)) {
      return p
    } else {
      return findAncestor(p, ofType)
    }
  } else {
    if (doNotThrow) return null
    throw new Error('Cannot find ancestor with type')
  }
}