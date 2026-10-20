export function refuseUnhandled<T>(_value: never, refusal: T): T {
    return refusal;
}
