type Instance = {}
type Caller = (T: Instance, args?: any) => any
type Hinj = Caller & {
    sync: (fn: (T: Instance, args?: any) => any) => Hinj,
    async: (fn: (T: Instance, args?: any) => any) => Hinj
}
export function hinj(starting?: any): Hinj


export function group<T extends object>(exports: T): T & {
    (P?: Instance) : Instance;
}