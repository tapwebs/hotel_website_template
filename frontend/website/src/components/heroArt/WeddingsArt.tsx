import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'

const marigolds = [110, 125, 140, 155, 170, 185, 200].map((y): [number, number, number] => [58, y, 2.8])

/** Weddings & Events: a domed mandap with a marigold toran, garland strings and the sacred fire. */
export function WeddingsArt({ className }: ArtProps) {
  return (
    <HeroSvg id="weddings" className={className}>
      <Grad id="weddings">
        {/* kalash finial and dome */}
        <Shapes d={['M120 36V22']} c={[[120, 17, 4]]} />
        <Sym d={['M28 84C44 56 84 40 120 36']} />
        {/* havan flame */}
        <Shapes d={['M120 196q-10 -12 0 -28q10 16 0 28Z', 'M120 190q-4 -6 0 -12']} />
      </Grad>
      {/* roof, pillars, plinth, havan kund */}
      <Shapes d={['M106 200H134V210H106Z']} />
      <Sym
        d={[
          'M24 84H120',
          'M28 92H120',
          'M40 92V218',
          'M50 92V218',
          'M36 100H54',
          'M34 210H56',
          'M22 218H120',
          'M14 230H120',
          'M22 218L14 230',
        ]}
      />
      <Gold>
        {/* toran: four swags with hanging marigolds and leaves */}
        <Shapes
          d={[
            'M50 98q17.5 18 35 0q17.5 18 35 0q17.5 18 35 0q17.5 18 35 0',
            'M85 98v8',
            'M120 98v8',
            'M155 98v8',
            'M85 106l-3 5l3 5l3 -5Z',
            'M120 106l-3 5l3 5l3 -5Z',
            'M155 106l-3 5l3 5l3 -5Z',
          ]}
          c={[
            [67.5, 114, 3.5],
            [102.5, 114, 3.5],
            [137.5, 114, 3.5],
            [172.5, 114, 3.5],
          ]}
        />
        {/* marigold strings down the pillars */}
        <Sym c={marigolds} />
      </Gold>
    </HeroSvg>
  )
}
