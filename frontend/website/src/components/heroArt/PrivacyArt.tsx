import { Gold, Grad, HeroSvg, Shapes, type ArtProps } from './svg'
import { petals, spokes } from './geometry'

/** Privacy Policy: a padlock set in a scalloped jali rosette. */
export function PrivacyArt({ className }: ArtProps) {
  return (
    <HeroSvg id="privacy" className={className}>
      <Gold>
        <Shapes
          d={petals(12, 120, 120, 70, 84, 6)}
          c={[
            [120, 120, 70],
            [120, 120, 62],
          ]}
        />
      </Gold>
      <Grad id="privacy">
        <Shapes d={spokes(12, 120, 120, 46, 62, 15)} />
      </Grad>
      <Shapes d={['M102 112V98A18 18 0 0 1 138 98V112', 'M92 112H148V152H92Z', 'M120 133V142']} c={[[120, 128, 5]]} />
    </HeroSvg>
  )
}
