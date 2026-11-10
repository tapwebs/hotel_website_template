import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Picture } from '@/components/Picture'
import { images } from '@/data/images'
import { cn, container } from '@/lib/utils'

export function DiningTeaser() {
  return (
    <section aria-labelledby="dining-teaser-title" className="relative">
      <Picture
        image={images.home.diningTeaser}
        sizes="100vw"
        className="h-[40svh] min-h-[16rem] max-md:h-[32svh] max-md:min-h-[14rem] md:h-[70svh] md:min-h-[26rem] w-full overflow-hidden"
        imgClassName="object-[50%_35%] m-parallax"
      />
      <div className={cn(container, 'relative -mt-16 pb-10 md:pb-16 sm:-mt-48 lg:pb-28')}>
        <div className="m-reveal grid max-w-xl gap-3 rounded-md bg-ivory p-5 md:gap-5 md:p-7 shadow-[0_30px_60px_-30px_rgb(36_24_18/0.5)] sm:p-10">
          <h2 id="dining-teaser-title" className="text-h2 text-burgundy-deep">
            A North Indian kitchen guests talk about
          </h2>
          <p className="text-walnut">
            Breakfast, lunch and dinner, from slow-cooked dal makhani to quick fast-food plates. Catering for every celebration in the hall
            or on the lawn.
          </p>
          <Button asChild variant="outline" className="justify-self-start">
            <Link to="/dining">See the restaurant and menu</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
