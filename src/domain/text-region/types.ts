import type { Rect } from '@/domain/shared/geometry'

export type TextAlign = 'left' | 'center' | 'right'
export type PaintMode = 'transparent' | 'solid' | 'gradient'
export type StrokePosition = 'inside' | 'outside'

export interface TextPaint {
  mode: PaintMode
  color: string
  gradientEnd?: string
  /** Gradient direction in degrees (0 = left to right). */
  gradientAngle?: number
  /** Opacity multiplier from 0 to 1. */
  alpha?: number
  gradientEndAlpha?: number
}

export interface TextStroke {
  width: number
  position: StrokePosition
  paint: TextPaint
}

export interface TextShadow {
  color: string
  blur: number
  offsetX: number
  offsetY: number
  alpha?: number
}

export interface TextStyleLayer {
  id: string
  enabled: boolean
  render: TextRenderConfig
}

export interface TextRenderConfig {
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: TextAlign
  lineHeight?: number
  fill?: TextPaint
  stroke?: TextStroke
  shadow?: TextShadow
  shadows?: TextShadow[]
  layers?: TextStyleLayer[]
}

export interface TextStyleTemplate {
  id: string
  name: string
  render: TextRenderConfig
}

export interface TextRegion {
  id: string
  rect: Rect
  rotation: number
  translationKey: string
  styleId?: string
  sourceText?: string
  translatedText?: string
  render?: TextRenderConfig
}

export interface SpriteTranslation {
  spriteTableId: string
  spriteId: string
  backgroundId?: string
  backgroundType?: 'original' | 'blank' | 'template' | 'sprite'
  textRegions: TextRegion[]
}

export function resolveBackgroundType(
  translation: Pick<SpriteTranslation, 'backgroundType' | 'backgroundId'>,
): NonNullable<SpriteTranslation['backgroundType']> {
  return translation.backgroundType ?? (translation.backgroundId ? 'template' : 'original')
}
