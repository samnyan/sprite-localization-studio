declare const UTEX: {
  readBC1(
    data: Uint8Array,
    offset: number,
    image: Uint8Array,
    width: number,
    height: number,
  ): number
  readBC2(
    data: Uint8Array,
    offset: number,
    image: Uint8Array,
    width: number,
    height: number,
  ): number
  readBC3(
    data: Uint8Array,
    offset: number,
    image: Uint8Array,
    width: number,
    height: number,
  ): number
  writeBC1(
    image: Uint8Array,
    width: number,
    height: number,
    data: Uint8Array,
    offset: number,
  ): number
  writeBC3(
    image: Uint8Array,
    width: number,
    height: number,
    data: Uint8Array,
    offset: number,
  ): number
}
export default UTEX
