import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'
import { petals, spokes } from './geometry'

/** Gallery: three framed arches like a picture wall, a camera-lens rosette in the tallest one. */
export function GalleryArt({ className }: ArtProps) {
  return (
    <HeroSvg id="gallery" className={className}>
      {/* arch frames, floor line, finial */}
      <Shapes d={['M120 58V46']} c={[[120, 42, 3]]} />
      <Sym
        d={[
          'M18 212V136C18 118 30 106 46 104C62 106 74 118 74 136V212',
          'M26 212V138C26 124 34 114 46 112C58 114 66 124 66 138V212',
          'M84 212V104C84 80 100 64 120 58',
          'M92 212V106C92 86 104 74 120 70',
          'M8 212H120',
          'M30 190l10 -14l8 8l6 -6l8 12',
        ]}
      />
      <Gold>
        <Sym c={[[54, 160, 3]]} />
        {/* lens rings and focus ticks */}
        <Shapes
          d={spokes(12, 120, 140, 25, 29)}
          c={[
            [120, 140, 24],
            [120, 140, 17],
          ]}
        />
      </Gold>
      {/* aperture blades */}
      <Grad id="gallery">
        <Shapes d={petals(6, 120, 140, 4, 16, 5, 30)} c={[[120, 140, 4]]} />
      </Grad>
    </HeroSvg>
  )
}
