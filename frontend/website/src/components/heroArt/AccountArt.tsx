import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'

/** Log in / Sign up: an arched double door under a small toran, lamps hanging either side. */
export function AccountArt({ className }: ArtProps) {
  return (
    <HeroSvg id="account" className={className}>
      <Shapes d={['M120 80V226']} />
      <Sym d={['M74 226V120C74 92 96 74 120 70', 'M84 226V122C84 98 102 84 120 80', 'M64 226H120', 'M56 234H120']} />
      <Gold>
        <Shapes d={['M88 112q8 8 16 0q8 8 16 0q8 8 16 0q8 8 16 0']} />
        <Sym
          c={[
            [100, 140, 1.5],
            [100, 170, 1.5],
            [100, 200, 1.5],
            [112, 168, 4],
          ]}
        />
      </Gold>
      <Grad id="account">
        <Sym d={['M40 40V64', 'M34 64H46L44 80H36Z', 'M40 80V86']} c={[[40, 90, 2]]} />
      </Grad>
    </HeroSvg>
  )
}
