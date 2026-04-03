import {
  ACCESSOR,
  HINGES_ANCESTRY_PROP,
  HINGES_FACTORY_PROP,
  RAW_STACK,
  IS_ASYNC,
  STARTING_VALUE,
  IS_PIPE,
} from "./consts.mjs";
import { stateBody } from "./stateBody.mjs";

/**
 * @template T {function(*, *=): *}
 * @template R {sync: T, async: T}
 * @param starting
 * @returns {{sync: T, async: T} & function(*, *=): *}
 */
let pi = 0;

export const state = (starting) => {
    const stack = factory()

    const state = stateBody(stack, starting)
    // state[RAW_STACK] = stack
    state[HINGES_ANCESTRY_PROP] = stack[HINGES_ANCESTRY_PROP]
    state[ACCESSOR] = stack[ACCESSOR]
    // state[STARTING_VALUE] = starting;
}
export const pipe = () => {
  const pipe = factory()
  // pipe[RAW_STACK] = stack
  pipe[IS_PIPE] = true
  return pipe
}

function factory(plugins) {
    // const builder = builderPrototype();
    const pointer = Symbol(pi++);
    const builder = () => stack();
    let stack = null;
    // let stack = builder()

    builder[ACCESSOR] = pointer;
    builder[HINGES_ANCESTRY_PROP] = [pointer];

    let isAsyncMode = (builder[IS_ASYNC] = false);

    if (plugins) {
      for (const [name, fn] of Object.entries(plugins)) {
        builder[name] = fn;
      }
    }

    builder.sync = (wfn) => {
      if (wfn[ACCESSOR]) {
        builder[HINGES_ANCESTRY_PROP] = [
          ...builder[HINGES_ANCESTRY_PROP],
          ...wfn[HINGES_ANCESTRY_PROP],
        ];
        if (wfn[STARTING_VALUE] && !builder[STARTING_VALUE]) {
          builder[STARTING_VALUE] = wfn[STARTING_VALUE];
        }

        // wfn might be wrapped in a `group` or might be a raw `hinj`
        wfn = wfn[RAW_STACK] || wfn;

        if (!wfn) throw new Error("Must be a function");
      }
      // if (wfn[STARTING_VALUE] && !builder[STARTING_VALUE]) {
      //   builder[STARTING_VALUE] = wfn[STARTING_VALUE];
      // }

      if (!stack) {
        stack = (_t, v, p) => {
          const vNext = wfn(_t, v, p);
          return vNext; //=== undefined ? v : vNext
        };
      } else {
        // existing function
        const pfn = stack;
        // must await
        if (isAsyncMode) {
          stack = (_t, v, p) => {
            return pfn(_t, v, p).then((returnValue) => {
              const vNext = wfn(
                _t,
                returnValue === undefined ? v : returnValue,
                p,
              );
              return vNext; //=== undefined ? v : vNext
            });
          };
        } else {
          stack = (_t, v, p) => {
            const returnValue = pfn(_t, v, p);
            const vNext = wfn(
              _t,
              returnValue === undefined ? v : returnValue,
              p,
            );
            return vNext; //=== undefined ? v : vNext
          };
        }
      }

      return builder;
    };

    builder.async = (wfn) => {
      if (wfn[ACCESSOR]) {
        builder[HINGES_ANCESTRY_PROP] = [
          ...builder[HINGES_ANCESTRY_PROP],
          ...wfn[HINGES_ANCESTRY_PROP],
        ];
        if (!builder[STARTING_VALUE] && wfn[STARTING_VALUE]) {
          builder[STARTING_VALUE] = wfn[STARTING_VALUE];
        }

        // wfn might be wrapped in a `group` or might be a raw `hinj`
        wfn = wfn[RAW_STACK] || wfn;

        if (!wfn) throw new Error("Must be a function");
      }

      if (!stack) {
        stack = (_t, vP, p) => {
          const vNext = wfn(_t, vP, p);
          if (vNext?.then) {
            return vNext; // === undefined ? v : vNext
          } else {
            throw new Error("Must be awaitable");
          }
        };
      } else {
        // keep the reference to the stack as it is at this point of building
        const currentStack = stack;
        // existing function wrapped into Promise if needed
        const pfn =
          isAsyncMode ? currentStack : (
            (_t, vP, p) => {
              return Promise.resolve(currentStack(_t, vP, p));
            }
          );
        const next = (_t, v, p) => {
          const vNext = wfn(_t, v, p);
          if (vNext?.then) {
            return vNext; //=== undefined ? v : vNext
          } else {
            throw new Error("Must be awaitable");
          }
        };

        stack = (_t, vP, p) => {
          const r = pfn(_t, vP, p);
          return r.then((returningValue) =>
            next(_t, returningValue === undefined ? vP : returningValue, p),
          );
        };
      }

      isAsyncMode = builder[IS_ASYNC] = true;

      return builder;
    };

    // TODO. Must and Debug functions
    // TODO. must and debug should unwrap promises automatically

    builder.debug = (tag, showStack = false) => {
      builder.sync((T, a) => {
        const v = T[pointer];
        const e = new Error();

        console.info(tag || "-state-", v);
        if (showStack) console.info(tag || "-state-", a, e);
      });

      return builder;
    };

    return builder;
  };
