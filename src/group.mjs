import {
  ACCESSOR,
  HINGES_ANCESTRY_PROP,
  HINGES_FACTORY_PROP,
  HINGES_PARENT_PROP,
  HINGES_TYPE_PROP,
  HINJ_NAME,
  IS_ASYNC,
  RAW_STACK, STARTING_VALUE
} from "./consts.mjs";
import {isOfType} from "./isOfType.mjs";
import {findAncestor} from "./findAncestor.mjs";

/**
 * @template T
 * @param fn
 * @param {T} exports
 * @returns {T & function(*, *=): *}
 */
export function group(exports) {
  if (!exports) {
    throw new Error('Must pass an exports object')
  }

  const objectType = Symbol(String.fromCharCode(Math.round(Math.random() * 29)) + Math.random())
  const caller = (PT /* multiple inheritance placeholder */) => {
    const T = {
      [HINGES_PARENT_PROP]: PT || null,
      [HINGES_FACTORY_PROP]: caller,
      [HINGES_TYPE_PROP]: objectType
    }
    return T
  }

  caller[HINGES_TYPE_PROP] = objectType

  // todo. make sure not to let exported state be set from outside
  const liftedExports = exports && processExports(exports, objectType)
  if (liftedExports && 'name' in liftedExports) {
    throw new Error('`name` is a reserved keyword that cannot be exported')
  }

  if (liftedExports) {
    for (const [name, fn] of Object.entries(liftedExports)) {
      for (const a of (fn[HINGES_ANCESTRY_PROP] || [])) {
        caller[a] = fn[RAW_STACK]
      }
    }
  }

  return liftedExports && Object.assign(caller, liftedExports) || caller
}

function processExports(exports, ofType) {
  const liftedExports = Object.fromEntries(
      Object.entries(exports)
          .map(([k, v]) => {
            if (v[RAW_STACK]) return [k, v]

            const isCommand = k.startsWith('$')

            if (!v[HINGES_TYPE_PROP]) {
              v[HINGES_TYPE_PROP] = ofType
            }
            v[HINGES_TYPE_PROP] = ofType
            const fn = (T, args, p) => {
              const pointer = p || v[ACCESSOR]
              const _stack = T[HINGES_FACTORY_PROP][pointer]
              const _this = !!_stack ? T : findAncestor(T, pointer)

              const stack = _stack || _this[HINGES_FACTORY_PROP][pointer]

              // if (isCommand) {
              // if (args === undefined) throw new Error('Must pass arguments or `null` to command')
              // return stack.cmd(_this, args, pointer)
              // } else {
              return stack(_this, args, )
              // }

            }

            fn[RAW_STACK] = isCommand ? v.asCmd() : v
            fn[HINJ_NAME] = k
            fn[HINGES_ANCESTRY_PROP] = v[HINGES_ANCESTRY_PROP]
            fn[ACCESSOR] = v[ACCESSOR]
            fn[IS_ASYNC] = v[IS_ASYNC]

            fn.has = (T) => {
              return isOfType(T, fn[ACCESSOR])
            }

            return [k, fn]
          }))

  return liftedExports
}