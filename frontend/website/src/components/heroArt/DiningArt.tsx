import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'
import { petals } from './geometry'

/** Dining: pierced-brass lantern over a thali with katoris, a tandoor with flames, star anise and chillies. */
export function DiningArt({ className }: ArtProps) {
  return (
    <HeroSvg id="dining" className={className}>
      <Grad id="dining">
        {/* hanging lantern */}
        <Shapes d={['M120 4V26', 'M110 26H130', 'M120 30V78', 'M120 84V92']} c={[[120, 96, 3]]} />
        <Sym
          d={['M112 26L106 34', 'M106 34C100 46 100 66 106 78', 'M113 30C110 46 110 64 113 80', 'M106 78L112 84H120']}
          c={[
            [109, 50, 1.2],
            [109, 62, 1.2],
          ]}
        />
      </Grad>
      {/* thali: plate, rim, rice mound, four katoris */}
      <Shapes
        d={['M106 186Q120 166 134 186Z', 'M110 180q10 -6 20 0']}
        c={[
          [120, 180, 54],
          [120, 180, 47],
        ]}
      />
      <Sym
        c={[
          [96, 158, 10],
          [96, 158, 6],
          [96, 202, 9],
        ]}
      />
      <Gold>
        {/* steam over the rice */}
        <Shapes d={['M120 164q-4 -6 0 -11q4 -6 0 -11']} />
        {/* star anise, top left */}
        <Shapes d={petals(8, 36, 70, 3, 15, 4)} c={[[36, 70, 2]]} />
        {/* tandoor flames, top right */}
        <Shapes d={['M202 66q-4 -8 2 -14', 'M210 64q-4 -10 2 -18', 'M218 66q-4 -8 2 -14']} />
      </Gold>
      {/* tandoor */}
      <Shapes d={['M190 70H226', 'M194 70C188 90 192 104 198 110H218C224 104 228 90 222 70', 'M192 84H224', 'M196 98H220']} />
      {/* chillies, mirrored */}
      <Grad id="dining">
        <Sym d={['M14 156C20 182 36 200 58 210C42 196 30 178 24 154Z', 'M24 154q-4 -8 2 -12']} />
      </Grad>
    </HeroSvg>
  )
}
