import {
  ACCESSOR,
  HINGES_ANCESTRY_PROP,
  HINGES_FACTORY_PROP,
  RAW_STACK,
  IS_ASYNC,
  STARTING_VALUE,
  IS_PIPE,
} from "./consts.mjs";

/**
 * @template T {function(*, *=): *}
 * @template R {sync: T, async: T}
 * @param starting
 * @returns {{sync: T, async: T} & function(*, *=): *}
 */
let pi = 0;

const stateBody = () => {
  const builder = (_this, args = undefined, remappedPointer) => {
    if (!remappedPointer) remappedPointer = builder[ACCESSOR];
    if (args !== undefined) {
      // _this[remappedPointer] = args;
      if (stack) {
        const returnValue = stack(_this, args, remappedPointer);
        if (returnValue !== undefined) {
          return (_this[remappedPointer] = returnValue);
        } else {
          return (_this[remappedPointer] = args);
        }
      } else {
        return (_this[remappedPointer] = args);
      }
    } else {
      // when args are undefined we are not setting, only returning
      // unless there is a starting value which gets run through the chain once

      if (_this[remappedPointer] === undefined) {
        if (typeof builder[STARTING_VALUE] == "function") {
          const v = builder[STARTING_VALUE](_this);

          if (stack) {
            const returnValue = stack(_this, v, remappedPointer);
            if (returnValue !== undefined) {
              _this[remappedPointer] = returnValue;
            } else {
              _this[remappedPointer] = v;
            }
          }
        } else if (builder[STARTING_VALUE] !== undefined) {
          const v = builder[STARTING_VALUE];

          const returnValue = stack(_this, v, remappedPointer);
          if (returnValue !== undefined) {
            _this[remappedPointer] = returnValue;
          } else {
            _this[remappedPointer] = v;
          }
        }
      }
      return _this[remappedPointer];
    }
  }
  return builder
};

const pipeBody = (isSubCommand) => {
  const builder = (_this, args, remappedPointer) => {
    if (!remappedPointer) remappedPointer = builder[ACCESSOR]
    if (builder[IS_ASYNC]) {
      // const startingValue =
      //     _this[HINGES_FACTORY_PROP][remappedPointer][STARTING_VALUE]
      // const startingValue = stack && stack[STARTING_VALUE]

      const pipeReturnDef = !isSubCommand && builder[STARTING_VALUE];

      const r = stack && stack(_this, args, remappedPointer);

      return r.then((returnValue) => {
        if (typeof pipeReturnDef == "function") {
          return pipeReturnDef(
            _this,
            returnValue !== undefined ? returnValue : args,
          );
        } else {
          return pipeReturnDef !== undefined ? pipeReturnDef : returnValue;
        }
      });
    } else {
      const pipeReturnDef = builder[STARTING_VALUE];

      const returnValue = stack && stack(_this, args, remappedPointer);

      if (typeof pipeReturnDef == "function") {
        return pipeReturnDef(
          _this,
          returnValue !== undefined ? returnValue : args,
        );
      } else {
        return pipeReturnDef !== undefined ? pipeReturnDef : returnValue;
      }
    }
  };

  builder[IS_PIPE] = true;
  return builder;
};

export const state = factory(stateBody);
export const pipe = factory(pipeBody);

function factory(builderPrototype, plugins) {
  return function (starting = undefined) {
    const builder = builderPrototype();
    const pointer = Symbol(pi++);
    // let stack = null;
    let stack = builder()

    builder[STARTING_VALUE] = starting;
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
}
