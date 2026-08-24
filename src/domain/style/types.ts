export type HorizontalAlignment = 'left' | 'center' | 'right'
export type VerticalAlignment = 'top' | 'middle' | 'bottom'

export interface TextStyle {
  id: string
  name: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  fill: string
  horizontalAlign: HorizontalAlignment
  verticalAlign: VerticalAlignment
  lineHeight?: number
  letterSpacing?: number
  wrap: boolean
}
