import {
  ACCESSOR,
  HINGES_ANCESTRY_PROP,
  HINGES_FACTORY_PROP,
  HINGES_PARENT_PROP,
  HINGES_TYPE_PROP,
  HINJ_NAME,
  IS_ASYNC,
  IS_PIPE,
  RAW_STACK,
  STARTING_VALUE,
} from "./consts.mjs";
import { isOfType } from "./isOfType.mjs";
import { findAncestor } from "./findAncestor.mjs";

/**
 * @template T
 * @param fn
 * @param {T} exports
 * @returns {T & function(*, *=): *}
 */
export function group(...mixins) {
  if (!mixins.length) {
    throw new Error("Must pass an objects to group");
  }

  const objectType = Symbol(
    String.fromCharCode(Math.round(Math.random() * 29)) + Math.random(),
  );
  const caller = (PT /* multiple inheritance placeholder */) => {
    const T = {
      [HINGES_PARENT_PROP]: PT || null,
      [HINGES_FACTORY_PROP]: caller,
      [HINGES_TYPE_PROP]: objectType,
    };
    return T;
  };

  caller[HINGES_TYPE_PROP] = objectType;

  for (const mixin of mixins) {
    let exports;
    if (mixin[HINGES_TYPE_PROP]) {
      // these are existing groups

      for (const [name, fn] of Object.entries(mixin)) {
        for (const a of fn[HINGES_ANCESTRY_PROP] || []) {
          if (a in caller)
            console.warn(
              `State/pipe "${name}" is overwriting existing state/pipe`, a,
            );
          caller[a] = fn[RAW_STACK];
        }
      }
    } else {
      // these are straight objects
      // todo. make sure not to let exported state be set from outside
      const liftedExports = mixin && processExports(mixin, objectType);
      if (liftedExports && "name" in liftedExports) {
        throw new Error("`name` is a reserved keyword that cannot be exported");
      }
      // Object.assign(caller, liftedExports);

      for (const [name, fn] of Object.entries(liftedExports)) {
        caller[name] = fn;
        for (const a of fn[HINGES_ANCESTRY_PROP] || []) {
          caller[a] = fn[RAW_STACK];
        }
      }
    }

    // if (exports) {
    // }
  }

  return caller;
}

function processExports(exports, ofType) {
  const liftedExports = Object.fromEntries(
    Object.entries(exports).map(([k, v]) => {
      const isCommand = k.startsWith("$");
      if (
        (isCommand && !v[IS_PIPE]) ||
        (!isCommand && v[IS_PIPE])
      ) {
        throw new Error("Pipes must be marked with $");
      }

      if (v[RAW_STACK]) return [k, v];

      // static functions aren't hinjs
      const isStatic = k.startsWith("_");
      if (isStatic) {
        if (v[RAW_STACK])
          throw new Error("Static functions cannot be state() or pipe()");
        return [k, v];
      }


      if (!v[HINGES_TYPE_PROP]) {
        v[HINGES_TYPE_PROP] = ofType;
      }
      v[HINGES_TYPE_PROP] = ofType;
      const fn = (T, args, p) => {
        const pointer = p || v[ACCESSOR];
        const _stack = T[HINGES_FACTORY_PROP][pointer];
        const _this = !!_stack ? T : findAncestor(T, pointer);

        const stack = _stack || _this[HINGES_FACTORY_PROP][pointer];
        return stack(_this, args);
      };


      fn[RAW_STACK] = isCommand ? (v.asCmd && v.asCmd()) || v : v;
      fn[HINJ_NAME] = k;
      fn[HINGES_ANCESTRY_PROP] = v[HINGES_ANCESTRY_PROP];
      fn[ACCESSOR] = v[ACCESSOR];
      fn[IS_ASYNC] = v[IS_ASYNC];
      fn[STARTING_VALUE] = v[STARTING_VALUE];

      // if (v[STARTING_VALUE]) {
      //   debugger
      // }

      fn.has = (T) => {
        return isOfType(T, fn[ACCESSOR]);
      };

      return [k, fn];
    }),
  );

  return liftedExports;
}
