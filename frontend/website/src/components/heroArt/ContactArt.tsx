import { Gold, Grad, HeroSvg, Shapes, type ArtProps } from './svg'
import { spokes } from './geometry'

/** Contact: a map pin where two road lines meet, map contours, and a compass rose pointing north. */
export function ContactArt({ className }: ArtProps) {
  return (
    <HeroSvg id="contact" className={className}>
      <Grad id="contact">
        <Shapes
          d={['M120 160C100 132 88 116 88 96A32 32 0 0 1 152 96C152 116 140 132 120 160Z']}
          c={[
            [120, 96, 12],
            [120, 96, 4],
          ]}
        />
      </Grad>
      {/* road converging on the pin, centre dashes */}
      <Shapes d={['M64 236L114 168', 'M176 236L126 168', 'M120 230v-10', 'M120 212v-8', 'M120 196v-6', 'M120 182v-4']} />
      {/* compass rose star and N */}
      <Shapes
        d={['M44 26L48 44L66 48L48 52L44 70L40 52L22 48L40 44Z', 'M44 48L54 38M44 48L54 58M44 48L34 58M44 48L34 38', 'M41 14V7l6 7V7']}
      />
      <Gold>
        <Shapes
          d={[
            ...spokes(16, 44, 48, 21, 25),
            'M8 200Q40 186 70 196',
            'M170 196Q200 186 232 200',
            'M10 222Q30 214 52 220',
            'M188 222Q210 214 230 220',
          ]}
          c={[
            [44, 48, 26],
            [44, 48, 21],
          ]}
        />
      </Gold>
    </HeroSvg>
  )
}
