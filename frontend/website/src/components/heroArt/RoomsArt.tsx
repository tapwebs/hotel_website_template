import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'

/** Rooms: a jharokha window with tied-back curtains framing a made bed, crescent moon above. */
export function RoomsArt({ className }: ArtProps) {
  return (
    <HeroSvg id="rooms" className={className}>
      {/* jharokha arch, sill and finial */}
      <Shapes d={['M120 34V20']} c={[[120, 16, 3]]} />
      <Sym d={['M36 232V104C36 66 76 42 120 34', 'M50 232V108C50 76 84 56 120 50', 'M24 232H120', 'M50 214H120']} />
      {/* curtain rod and drapes */}
      <Grad id="rooms">
        <Shapes d={['M52 100H188']} />
        <Sym
          d={['M54 104C66 132 60 158 74 176C64 192 60 212 56 224', 'M54 116C60 140 56 160 64 176', 'M62 172q8 -2 14 6']}
          c={[[52, 100, 2.5]]}
        />
      </Grad>
      {/* bed: headboard, pillows, mattress, legs */}
      <Sym
        d={[
          'M84 172V152Q84 144 92 144H120',
          'M90 188Q88 174 100 174H112Q116 174 116 180V188Z',
          'M74 200V188H120',
          'M74 200H120',
          'M74 194H120',
          'M78 200V210',
        ]}
      />
      <Gold>
        <Shapes d={['M134 66a12 12 0 1 0 10 18a9 9 0 1 1 -10 -18Z', 'M100 72v6M97 75h6', 'M150 108v5M147.5 110.5h5']} />
      </Gold>
    </HeroSvg>
  )
}
