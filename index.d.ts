type Instance = {}
type Caller = (T: Instance, args?: any) => any
type Hinj = Caller & {
    sync: (fn: (T: Instance, args?: any) => any) => Hinj,
    async: (fn: (T: Instance, args?: any) => any) => Hinj
}

export function group<T extends object>(exports: T): T & {
    (P?: Instance) : Instance;
}

export function group<T extends object>(
  ...exports: T,
): {
  (P?: Instance): Instance;
};
export function state(starting?: any): Hinjs
export function pipe(): Hinjs