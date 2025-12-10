import {HINGES_ANCESTRY_PROP, HINGES_TYPE_PROP} from "./consts.mjs";

export function listAncestryFromExports(exports) {
  if (!exports.length) return null

  let list = [];
  for (const e of exports) {
    if (e[HINGES_TYPE_PROP]) {
      list.push(e)
      if (e[HINGES_ANCESTRY_PROP]) {
        list = list.concat(e[HINGES_ANCESTRY_PROP])
      }
    }
  }
  return list.length ? list : null
}