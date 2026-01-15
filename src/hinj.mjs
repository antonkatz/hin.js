import {
  ACCESSOR,
  HINGES_ANCESTRY_PROP,
  HINGES_FACTORY_PROP,
  RAW_STACK,
  IS_ASYNC,
  STARTING_VALUE,
} from "./consts.mjs";

/**
 * @template T {function(*, *=): *}
 * @template R {sync: T, async: T}
 * @param starting
 * @returns {{sync: T, async: T} & function(*, *=): *}
 */
let pi = 0;

export function hinj(starting = undefined) {
  const pointer = Symbol(pi++);
  let stack = null;

  const builder = (_this, args = undefined, remappedPointer = pointer) => {
    if (args !== undefined) {
      _this[remappedPointer] = args;
      if (stack) {
        return stack(_this, args, remappedPointer);
      }
    } else {
      // when args are undefined we are not setting, only returning
      // unless there is a starting value which gets run through the chain once

      if (_this[remappedPointer] === undefined) {
        if (typeof builder[STARTING_VALUE] == "function") {
          const v = (_this[remappedPointer] = builder[STARTING_VALUE](_this));

          if (stack) {
            stack(_this, v, remappedPointer);
          }
        } else if (builder[STARTING_VALUE] !== undefined) {
          const v = (_this[remappedPointer] = builder[STARTING_VALUE]);

          if (stack) {
            stack(_this, v, remappedPointer);
          }
        }
      }
      return _this[remappedPointer];
    }
  };
  builder[STARTING_VALUE] = starting;
  builder[ACCESSOR] = pointer;
  builder[HINGES_ANCESTRY_PROP] = [pointer];

  let isAsyncMode = (builder[IS_ASYNC] = false);

  builder.asCmd = (isSubCommand) => {
    const fn = isAsyncMode
      ? (_this, args, remappedPointer = pointer) => {
          // const startingValue =
          //     _this[HINGES_FACTORY_PROP][remappedPointer][STARTING_VALUE]
          // const startingValue = stack && stack[STARTING_VALUE]

          const startingValue = !isSubCommand && builder[STARTING_VALUE];

          const r = stack && stack(_this, args, remappedPointer);

          return r.then(() => {
            if (typeof startingValue == "function") {
              return startingValue(_this, args);
            } else {
              return startingValue;
            }
          });
        }
      : (_this, args, remappedPointer = pointer) => {
          const startingValue = !isSubCommand && builder[STARTING_VALUE];

          stack && stack(_this, args, remappedPointer);

          if (typeof startingValue == "function") {
            return startingValue(_this, args);
          } else {
            return startingValue;
          }
        };

    // fn[STARTING_VALUE] = builder[STARTING_VALUE];
    //   fn[ACCESSOR] = pointer;
    //   fn[HINGES_ANCESTRY_PROP] = [pointer];
    //   fn[IS_ASYNC] = isAsyncMode;
    // fn.asSubCommand = (_t, a, p) => {
    //   return builder.asCmd(true)
    // }
    fn.asCmd = builder.asCmd;

    return fn;
    // return builder;
  };

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
      if (wfn.asCmd) {
        wfn = wfn.asCmd(true); // make a subcommand
      }

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
          return pfn(_t, v, p).then(() => {
            const vNext = wfn(_t, v, p);
            return vNext; //=== undefined ? v : vNext
          });
        };
      } else {
        stack = (_t, v, p) => {
          pfn(_t, v, p);
          const vNext = wfn(_t, v, p);
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

      if (wfn.asCmd) {
        wfn = wfn.asCmd(true); // make a subcommand
      }

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
      const pfn = isAsyncMode
        ? currentStack
        : (_t, vP, p) => {
            return Promise.resolve(currentStack(_t, vP, p));
          };
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
        return r.then(() => next(_t, vP, p));
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
}
