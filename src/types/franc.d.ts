declare module 'franc' {
    export function franc(text: string, options?: { minLength?: number; only?: string[]; ignore?: string[] }): string
}
