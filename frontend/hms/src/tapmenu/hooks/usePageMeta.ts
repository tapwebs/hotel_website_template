import { useEffect } from 'react'

interface PageMetaOptions {
  title?: string
  description?: string
  canonical?: string
  canonicalPath?: string
  keywords?: string
  ogType?: string
  noindex?: boolean
}

export function usePageMeta({
  title,
  description,
  canonical,
  canonicalPath,
  keywords,
  ogType = 'website',
  noindex,
}: PageMetaOptions) {
  useEffect(() => {
    // 1. Set document title
    if (title) {
      const fullTitle = title.includes('TapMenu') ? title : `${title} — TapMenu`
      document.title = fullTitle

      // Sync og:title & twitter:title
      let ogTitle = document.querySelector('meta[property="og:title"]')
      if (!ogTitle) {
        ogTitle = document.createElement('meta')
        ogTitle.setAttribute('property', 'og:title')
        document.head.appendChild(ogTitle)
      }
      ogTitle.setAttribute('content', fullTitle)

      let twTitle = document.querySelector('meta[name="twitter:title"]')
      if (!twTitle) {
        twTitle = document.createElement('meta')
        twTitle.setAttribute('name', 'twitter:title')
        document.head.appendChild(twTitle)
      }
      twTitle.setAttribute('content', fullTitle)
    }

    // 2. Set meta description
    if (description) {
      let metaDesc = document.querySelector('meta[name="description"]')
      if (!metaDesc) {
        metaDesc = document.createElement('meta')
        metaDesc.setAttribute('name', 'description')
        document.head.appendChild(metaDesc)
      }
      metaDesc.setAttribute('content', description)

      // Sync og:description & twitter:description
      let ogDesc = document.querySelector('meta[property="og:description"]')
      if (!ogDesc) {
        ogDesc = document.createElement('meta')
        ogDesc.setAttribute('property', 'og:description')
        document.head.appendChild(ogDesc)
      }
      ogDesc.setAttribute('content', description)

      let twDesc = document.querySelector('meta[name="twitter:description"]')
      if (!twDesc) {
        twDesc = document.createElement('meta')
        twDesc.setAttribute('name', 'twitter:description')
        document.head.appendChild(twDesc)
      }
      twDesc.setAttribute('content', description)
    }

    // 3. Set canonical link and og:url
    const targetCanonical =
      canonical ||
      (canonicalPath
        ? `https://tapmenu.in${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
        : undefined)

    if (targetCanonical) {
      let linkCanonical = document.querySelector('link[rel="canonical"]')
      if (!linkCanonical) {
        linkCanonical = document.createElement('link')
        linkCanonical.setAttribute('rel', 'canonical')
        document.head.appendChild(linkCanonical)
      }
      linkCanonical.setAttribute('href', targetCanonical)

      let ogUrl = document.querySelector('meta[property="og:url"]')
      if (!ogUrl) {
        ogUrl = document.createElement('meta')
        ogUrl.setAttribute('property', 'og:url')
        document.head.appendChild(ogUrl)
      }
      ogUrl.setAttribute('content', targetCanonical)
    }

    // 4. Set keywords
    if (keywords) {
      let metaKeywords = document.querySelector('meta[name="keywords"]')
      if (!metaKeywords) {
        metaKeywords = document.createElement('meta')
        metaKeywords.setAttribute('name', 'keywords')
        document.head.appendChild(metaKeywords)
      }
      metaKeywords.setAttribute('content', keywords)
    }

    // 5. Set og:type
    let metaOgType = document.querySelector('meta[property="og:type"]')
    if (!metaOgType) {
      metaOgType = document.createElement('meta')
      metaOgType.setAttribute('property', 'og:type')
      document.head.appendChild(metaOgType)
    }
    metaOgType.setAttribute('content', ogType)

    // 6. Handle noindex
    let robotsMeta = document.querySelector('meta[name="robots"]')
    if (noindex) {
      if (!robotsMeta) {
        robotsMeta = document.createElement('meta')
        robotsMeta.setAttribute('name', 'robots')
        document.head.appendChild(robotsMeta)
      }
      robotsMeta.setAttribute('content', 'noindex, nofollow')
    } else if (robotsMeta) {
      robotsMeta.setAttribute(
        'content',
        'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
      )
    }
  }, [title, description, canonical, canonicalPath, keywords, ogType, noindex])
}
