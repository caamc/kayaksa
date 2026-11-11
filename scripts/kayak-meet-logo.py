# Generates the Kayak Meet logo files in packages/brand/logos. Run from the repo root: python3 scripts/kayak-meet-logo.py
OUT = "packages/brand/logos"
def mark(b1, b2, stem, wave):
    return f'''<g class="km-mark">
  <path fill="{b1}" d="M0 22 L30 22 L44 48.25 L44 81.3 Z"/>
  <path fill="{b2}" d="M92 22 L62 22 L48 48.25 L48 81.3 Z"/>
  <path fill="{stem}" d="M32 73 L46 92 L60 73 L60 122 L32 122 Z"/>
  <g fill="none" stroke="{wave}" stroke-width="5" stroke-linecap="round" class="km-waves">
    <path class="km-w1" d="M100 8 A 22 22 0 0 1 100 38"/>
    <path class="km-w2" d="M110 -2 A 34 34 0 0 1 110 48"/>
  </g>
</g>'''
def lockup(name, k, meet, dash, b1, b2, stem, wave):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 140" width="520" height="140" role="img" aria-label="Kayak Meet"><title>Kayak Meet</title>
<g transform="translate(8 8)">{mark(b1, b2, stem, wave)}</g>
<g font-family="Archivo, 'Archivo Expanded', Arial, Helvetica, sans-serif" font-weight="800" font-size="62">
  <text x="138" y="112" fill="{k}" textLength="178" lengthAdjust="spacingAndGlyphs">Kayak</text>
  <text x="330" y="112" fill="{meet}" textLength="178" lengthAdjust="spacingAndGlyphs">Meet</text>
</g>
<rect x="332" y="124" width="44" height="7" fill="{dash}"/>
</svg>'''
    open(f"{OUT}/{name}.svg", "w").write(svg)
lockup("KayakMeet_Logo_FullColour", "#0E2F3C", "#17807E", "#EE9B1E", "#17807E", "#EE9B1E", "#0E2F3C", "#17807E")
lockup("KayakMeet_Logo_Reversed", "#FFFFFF", "#5DB2AB", "#EE9B1E", "#5DB2AB", "#EE9B1E", "#FFFFFF", "#5DB2AB")
open(f"{OUT}/KayakMeet_Icon.svg", "w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Kayak Meet"><title>Kayak Meet</title><rect width="160" height="160" rx="34" fill="#0E2F3C"/><g transform="translate(18 20)">{mark("#5DB2AB", "#EE9B1E", "#FFFFFF", "#5DB2AB")}</g></svg>''')
open(f"{OUT}/KayakMeet_Mark.svg", "w").write(f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -8 136 136" width="136" height="136"><title>Kayak Meet</title>{mark("#17807E", "#EE9B1E", "#0E2F3C", "#17807E")}</svg>''')
