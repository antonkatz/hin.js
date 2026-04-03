import { ACCESSOR, STARTING_VALUE } from "./consts.mjs";

export const stateBody = (stack) => {
      const remappedPointer = stack[ACCESSOR];

  return (_this, args = undefined) => {
    // if (!remappedPointer) remappedPointer = builder[ACCESSOR];
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
  };
};
