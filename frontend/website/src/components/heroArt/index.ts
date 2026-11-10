import type { ComponentType } from 'react'
import { gallery, images, type ImageSlug, type SiteImage } from '@/data/images'
import type { ArtProps } from './svg'
import { AboutArt } from './AboutArt'
import { AccountArt } from './AccountArt'
import { ContactArt } from './ContactArt'
import { DiningArt } from './DiningArt'
import { GalleryArt } from './GalleryArt'
import { PrivacyArt } from './PrivacyArt'
import { RoomsArt } from './RoomsArt'
import { WeddingsArt } from './WeddingsArt'

/** Per-page hero dressing for PageIntro: a line-art motif and an optional background photo. */
export interface HeroDressing {
  art: ComponentType<ArtProps>
  image?: SiteImage
}

const fromGallery = (slug: ImageSlug) => gallery.find((g) => g.image.slug === slug)?.image

// Named exports (not one object) so each route chunk only pulls in its own art.
export const aboutHero: HeroDressing = { art: AboutArt, image: images.home.hero }
export const accountHero: HeroDressing = { art: AccountArt }
export const contactHero: HeroDressing = { art: ContactArt, image: images.home.location }
export const diningHero: HeroDressing = { art: DiningArt, image: images.home.diningTeaser }
export const galleryHero: HeroDressing = { art: GalleryArt, image: fromGallery('lobby-jali-chandelier') }
export const privacyHero: HeroDressing = { art: PrivacyArt }
export const roomsHero: HeroDressing = { art: RoomsArt, image: fromGallery('room-window-view') }
export const weddingsHero: HeroDressing = { art: WeddingsArt, image: images.weddings.hero }
