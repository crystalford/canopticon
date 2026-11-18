// What wrangler hands the share-card renderer for its two kinds of asset:
// a .wasm import is a compiled WebAssembly.Module (wrangler's default rule),
// a .ttf import is its bytes (the Data rule in wrangler.toml).

declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}

declare module "*.ttf" {
  const data: ArrayBuffer;
  export default data;
}
