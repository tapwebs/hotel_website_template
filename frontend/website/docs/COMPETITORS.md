# Competitor notes

Researched 2026-10-15. Method: fetched each public site (HTML + rendered text via Jina Reader) and public aggregator pages. No logins, no scraping behind walls. Search engines (DuckDuckGo/Bing) and Justdial/Tripadvisor/MakeMyTrip blocked automated access, so **ratings from those platforms were not retrieved** and are marked unverified. Nothing below is invented; anything not seen is marked `UNVERIFIED`.

Our property for reference: Hotel Dream Heaven’s, Agra Road, Bassi, Jaipur. Rooms from ₹2,000/night (`src/data/hotel.ts`), restaurant, banquet/wedding hall.

## The best competitor: DC Avenue Hotel & Restaurant

**URL:** https://dcavenuejaipur.com/ (seen 2026-10-15)

Why it is the best direct competitor:

- Same micro-location: Bassi, Agra Road, near Rajadhok Toll Plaza. Same search terms ("Hotel in Bassi Jaipur", "Budget Hotel Jaipur", "Banquet Hall Jaipur" are in its meta keywords).
- Same product mix: rooms + restaurant + banquet (home page copy mentions a wedding held in its banquet).
- It already has a booking-form UI on the home page (check-in, check-out, guests, room type), which is the bar our booking engine must clear.
- It is the only nearby competitor with a live, purpose-built site we could verify.

Where it is weak (our openings): see the profile below. In short, a client-rendered shell with no crawlable body, no structured data found, template-looking testimonials and unverifiable "Five Stars / Award-Winning" claims.

## Direct competitors (4 chosen; 3 verified by site, 1 by aggregator only)

### 1. DC Avenue Hotel & Restaurant (best competitor)

| Field              | Detail                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL                | https://dcavenuejaipur.com/                                                                                                                                                                                                                                                                                                                                                                                                       |
| Location           | Near Rajadhok Toll Plaza, Dudhly, Bassi, Agra Road, Jaipur (site copy, 2026-10-15)                                                                                                                                                                                                                                                                                                                                                |
| Positioning        | "Luxury" hotel with fine dining and banquet. Claims "Five Stars Jaipur", "Award-Winning Service" (self-declared, UNVERIFIED)                                                                                                                                                                                                                                                                                                      |
| Price band         | Site lists "from / night": Premium ₹2,499, Deluxe ₹3,999, Super Deluxe Suite ₹6,999 (own site, 2026-10-15). Self-published; current availability UNVERIFIED                                                                                                                                                                                                                                                                       |
| Public rating      | UNVERIFIED (Google/Tripadvisor not retrievable). On-site testimonials are unattributed to any platform                                                                                                                                                                                                                                                                                                                            |
| Strengths          | Strong visual brand; booking widget on the home page; room tiers; meta description and keyword targeting of Bassi/Agra Road                                                                                                                                                                                                                                                                                                       |
| Weaknesses         | Client-side rendered: raw HTML body is only `<div id="root">`, so crawlers/AI bots see the meta tags and nothing else. No JSON-LD found in the HTML. Booking widget claims "No credit card required to check availability", but no engine confirmed behind it (UNVERIFIED). Testimonials read as templated (names, cities, five stars). Luxury claims (spa, butler, 24/7 minibar) look out of line with a roadside Bassi property |
| Patterns to borrow | Home-page date/guest picker above the fold; named room tiers with a "from / night" price; location phrase "near Rajadhok Toll Plaza" as a landmark                                                                                                                                                                                                                                                                                |
| How we beat it     | Prerendered HTML + full schema (Hotel, FAQPage, Restaurant, EventVenue). Honest budget positioning from ₹2,000. Real, attributed reviews with a Google Reviews link. A real booking engine with live availability. Dedicated banquet page with capacity and enquiry form                                                                                                                                                          |

### 2. Heiwa Heaven The Resort

| Field              | Detail                                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL                | https://www.heiwaheaven.com/                                                                                                                                                                   |
| Location           | Agra Road, Jaipur, Rajasthan (site schema/address text)                                                                                                                                        |
| Positioning        | Destination-wedding and weekend-getaway resort; pure-veg restaurant, pool, marriage garden, banquet ("Riwaaz Banquet")                                                                         |
| Price band         | Not on the site's home page. Venuelook lists the wedding venue at "Rs.1500 per plate" and "Rs. 100000 full day" (venuelook.com, fetched 2026-10-15). Aggregator figures, UNVERIFIED as current |
| Public rating      | 4.5 from 2 reviews on Venuelook (2026-10-15). Tiny sample; Google rating UNVERIFIED                                                                                                            |
| Strengths          | Dedicated pages per room type and facility; strong wedding focus; 1 JSON-LD block present; phone numbers listed; sitemap.xml returns 200                                                       |
| Weaknesses         | Dated, image-heavy layout; no WhatsApp link found; no online booking engine seen (phone-led); room copy generic; no FAQ/schema depth seen                                                      |
| Patterns to borrow | One page per facility (restaurant, pool, lawn, banquet); package-style cards ("What are you in the mood for?")                                                                                 |
| How we beat it     | Faster, mobile-first pages; WhatsApp + online booking; clear room prices; richer structured data                                                                                               |

### 3. Hotel Titoz Restaurant and Banquet

| Field              | Detail                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| URL                | No official site found. Listing: https://weddingz.in/jaipur/hotel-titoz-restaurant-agra-road/ (fetched 2026-10-15)           |
| Location           | Goner Road, Machh Ki Pipli, near Rajvilash hotel, Jaipur 302031 (Weddingz listing). Agra-Road side of the city but not Bassi |
| Positioning        | Budget hotel + restaurant + banquet, capacity 100-150 (Weddingz)                                                             |
| Price band         | Weddingz: ₹350 / ₹550 per plate; "Average price of room: Rs. 2000" (Weddingz, 2026-10-15). Aggregator data, UNVERIFIED       |
| Public rating      | UNVERIFIED                                                                                                                   |
| Strengths          | Same budget + restaurant + banquet formula; visible on wedding marketplaces                                                  |
| Weaknesses         | No own website found, so all leads go through third-party portals                                                            |
| Patterns to borrow | Per-plate banquet price display and capacity range                                                                           |
| How we beat it     | Own-domain presence with local SEO and direct booking; no marketplace commission                                             |

### 4. Lebua Resort, Agra Road

| Field              | Detail                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| URL                | Official site not found (guessed domains failed). Listing: https://www.venuelook.com/jaipur/locality/agra-road/venuetype/top-30-banquet-halls (2026-10-15) |
| Location           | Agra Road, Jaipur (Venuelook)                                                                                                                              |
| Positioning        | Upper-mid resort: 63 rooms and suites, spa, restaurants and bar, banquet halls and lawns (Venuelook description)                                           |
| Price band         | Banquet "Rs.2500 per plate" (Venuelook). Room rates UNVERIFIED                                                                                             |
| Public rating      | UNVERIFIED                                                                                                                                                 |
| Strengths          | Full-service resort with multiple dining outlets and events                                                                                                |
| Weaknesses         | Official site unverified; positioned above our price band                                                                                                  |
| Patterns to borrow | Clear facilities list (rooms, dining, banquet, business)                                                                                                   |
| How we beat it     | Price and proximity for highway travellers and local weddings                                                                                              |

Not found: hotels in Chomu. No verifiable Chomu or Bassi-town competitor could be confirmed with a working official site in this pass. See "Unverified / gaps".

## Boutique design references (not competitors)

### A. Alsisar Haveli, Jaipur

- URL: https://www.alsisarhaveli.com/ (seen 2026-10-15)
- Location: Jaipur city (heritage haveli). Not a price competitor.
- Strengths: clear "Book Now" CTA in the header linking to an external booking engine (Staah Max), heritage storytelling, Tripadvisor review quotes tied to real reviews, social links.
- Weaknesses: Wix build, heavy page (about 700 KB HTML), mostly images.
- Borrow: persistent Book Now CTA; real review quotes that link to the source platform; short story section.

### B. Samode Haveli

- URL: https://www.samode.com/samode-haveli/ (seen 2026-10-15)
- Location: old Jaipur. Group also runs Samode Palace/Bagh on the Jaipur-Chomu side (not verified further).
- Strengths: clean sub-navigation (Living Spaces, Dining, Wellness, Gallery, E-brochure), "Book Now" to an external engine (AxisRooms), restrained editorial copy and photography.
- Weaknesses: no meta description on the page; no JSON-LD found; no WhatsApp CTA surfaced beyond footer links.
- Borrow: simple per-area navigation; downloadable e-brochure for weddings; calm tone.

## Comparison table

Values come from what was visible on the fetched home page. `?` = could not confirm.

| Site                 | Booking CTA      | WhatsApp        | Online booking engine | FAQ / schema           | Banquet page            | Gallery        | Mobile UX                    |
| -------------------- | ---------------- | --------------- | --------------------- | ---------------------- | ----------------------- | -------------- | ---------------------------- |
| **Ours (target)**    | Yes (form)       | Yes             | Planned               | Yes (19 Q&As, JSON-LD) | Yes                     | Yes            | Good (375px checked)         |
| DC Avenue            | Yes (widget)     | ?               | ? (widget only)       | No JSON-LD found       | Mentioned, no page seen | Yes            | Viewport tag set; not tested |
| Heiwa Heaven         | Phone-led        | Not found       | No                    | 1 JSON-LD, no FAQ seen | Yes                     | Yes            | Viewport tag set; not tested |
| Titoz                | Marketplace only | ?               | No                    | ?                      | Listing only            | Listing photos | ?                            |
| Lebua Resort         | ?                | ?               | ?                     | ?                      | Listing only            | Listing photos | ?                            |
| Alsisar Haveli (ref) | Yes (header)     | ?               | Yes (Staah)           | ?                      | No                      | Yes            | Wix responsive               |
| Samode Haveli (ref)  | Yes (header)     | Links in footer | Yes (AxisRooms)       | No                     | No                      | Yes            | Responsive                   |

## What this means for our product

1. The closest rival (DC Avenue) sells on luxury claims and has an invisible-to-crawlers site. Our edge is honest budget value, crawlable content, schema, and real reviews.
2. Boutique references both hand off to an external booking engine from a persistent header CTA. Our own engine should keep that same single, obvious CTA.
3. Nobody checked offers WhatsApp-first enquiry plus a banquet enquiry form with capacity. We already have both.

## Unverified / gaps

- Google, Tripadvisor, MakeMyTrip and Justdial ratings for every competitor (platforms blocked automated access).
- Whether DC Avenue's widget completes a booking, and whether its sitemap is real (returned 200, possibly a SPA fallback).
- Official sites for Hotel Titoz and Lebua Resort.
- Any Chomu-area hotel. Recommend a manual pass: search Google Maps for "hotel Chomu" and "hotel Bassi", note the top 3 by review count, then add them here.
- All prices are listed-by-source on the date shown and may be stale. Do not quote them in marketing.

## Sources

- https://dcavenuejaipur.com/ (2026-10-15)
- https://www.heiwaheaven.com/ (2026-10-15)
- https://www.venuelook.com/jaipur/locality/agra-road (2026-10-15)
- https://www.venuelook.com/jaipur/locality/agra-road/venuetype/top-30-banquet-halls (2026-10-15)
- https://weddingz.in/jaipur/hotel-titoz-restaurant-agra-road/ (2026-10-15)
- https://www.alsisarhaveli.com/ (2026-10-15)
- https://www.samode.com/samode-haveli/ (2026-10-15)
