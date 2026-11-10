<?xml version="1.0" encoding="UTF-8"?>
<!-- Browser-only styling for /sitemap.xml. Crawlers ignore this file and read the plain XML. -->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
  exclude-result-prefixes="sm">
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat"/>

  <xsl:template match="/">
    <html lang="en-IN">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <meta name="robots" content="noindex, follow"/>
        <title>Sitemap · TapMenu Grand Resort</title>
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png"/>
        <style>
          :root { --ivory:#fbf7f0; --burgundy:#6e1e2b; --deep:#4a111b; --gold:#c6a15b; --soft:#e3cf9f; --ink:#2b1a1d; }
          * { box-sizing: border-box; }
          body { margin:0; background:var(--ivory); color:var(--ink); font:16px/1.6 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
          header { background:var(--deep); color:var(--ivory); padding:2.5rem 1.25rem; text-align:center; border-bottom:4px solid var(--gold); }
          header img { width:72px; height:72px; object-fit:contain; margin-bottom:.5rem; }
          h1 { margin:0; font:500 clamp(1.75rem,5vw,2.5rem)/1.2 Georgia,"Times New Roman",serif; color:var(--soft); }
          header p { margin:.5rem auto 0; max-width:40rem; opacity:.9; }
          main { max-width:52rem; margin:0 auto; padding:2rem 1.25rem 3rem; }
          .count { color:var(--burgundy); font-weight:600; margin:0 0 1rem; }
          ol { list-style:none; margin:0; padding:0; counter-reset:n; }
          li { counter-increment:n; background:#fff; border:1px solid var(--soft); border-radius:10px; margin-bottom:.6rem; }
          li a { display:flex; gap:.9rem; align-items:center; padding:.9rem 1rem; color:var(--burgundy); text-decoration:none; word-break:break-all; }
          li a::before { content:counter(n); flex:none; width:2rem; height:2rem; border-radius:50%; background:var(--burgundy); color:var(--ivory); display:grid; place-items:center; font-size:.85rem; font-weight:600; }
          li a:hover, li a:focus-visible { background:#fff7e6; outline:2px solid var(--gold); outline-offset:-2px; border-radius:10px; }
          footer { text-align:center; font-size:.875rem; color:#6b5a5d; padding:0 1.25rem 2rem; }
          footer a { color:var(--burgundy); }
        </style>
      </head>
      <body>
        <header>
          <img src="/logo.png" alt="TapMenu Grand Resort logo" width="72" height="72"/>
          <h1>TapMenu Grand Resort</h1>
          <p>Sitemap of every public page on TapMenu Grand Resort: rooms, dining, weddings and events.</p>
        </header>
        <main>
          <p class="count"><xsl:value-of select="count(sm:urlset/sm:url)"/> pages</p>
          <ol>
            <xsl:for-each select="sm:urlset/sm:url">
              <li><a href="{sm:loc}"><xsl:value-of select="sm:loc"/></a></li>
            </xsl:for-each>
          </ol>
        </main>
        <footer>
          <p><a href="/">Back to TapMenu Grand Resort</a></p>
        </footer>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
