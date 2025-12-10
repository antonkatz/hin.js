import {HINGES_PARENT_PROP, RAW_STACK} from "./consts.mjs";

export function exit(fn) {
  const caller = (T, args = undefined) => {
    if (T?.[HINGES_PARENT_PROP] !== undefined) {
      // everything is good
    } else {
      if (args != undefined) {
        throw new Error('Enter must be called with an HINGES object as the first argument OR with a single argument')
      } else {
        args = T
        T = null
      }
    }
    const opRes = fn(T, args)
    if (opRes === undefined) {
      throw new Error('Exit must return something')
    }
    return opRes
  }

  caller[RAW_STACK] = fn

  return caller
}