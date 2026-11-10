import { Gold, Grad, HeroSvg, Shapes, Sym, type ArtProps } from './svg'

/** About: a haveli facade with chhatris, jharokha windows and an arched door, a peacock on the right chhatri. */
export function AboutArt({ className }: ArtProps) {
  return (
    <HeroSvg id="about" className={className}>
      {/* haveli: walls, parapet, chhatris, central dome, windows, door */}
      <Shapes d={['M120 74V62', 'M120 178V230']} c={[[120, 58, 3]]} />
      <Sym
        d={[
          'M30 230V118',
          'M22 230H120',
          'M24 118H120',
          'M26 110H120',
          'M30 182H120',
          'M30 110C30 94 40 88 46 88C52 88 62 94 62 110',
          'M46 88V80',
          'M90 110C90 88 104 78 120 74',
          'M42 168V150C42 142 48 138 54 136C60 138 66 142 66 150V168',
          'M76 168V150C76 142 82 138 88 136C94 138 100 142 100 150V168',
          'M106 230V196C106 186 112 180 120 178',
        ]}
      />
      <Gold>
        <Sym d={['M38 168H70', 'M38 132H70', 'M72 168H104', 'M72 132H104']} c={[[46, 77, 2]]} />
      </Gold>
      {/* peacock perched on the right chhatri */}
      <Grad id="about">
        <Shapes
          d={[
            'M188 76C184 66 186 58 192 54C194 46 192 40 190 36',
            'M192 54C200 58 204 66 200 76',
            'M188 33l-4 1',
            'M191 30l-2 -6M193 30l1 -6M195 31l3 -5',
            'M200 74C212 82 222 96 228 118',
            'M196 78C206 90 214 106 216 128',
          ]}
          c={[
            [191, 33, 3],
            [226, 112, 3.5],
            [214, 122, 3.5],
            [222, 98, 3],
          ]}
        />
      </Grad>
    </HeroSvg>
  )
}
