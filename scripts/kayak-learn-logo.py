# Generates the Kayak Learn logo files in packages/brand/logos. Run from the repo root: python3 scripts/kayak-learn-logo.py
import os
OUT="packages/brand/logos"
def ident(blade1,blade2,stem,cap,tassel):
    return f'''<g class="kl-mark">
  <path class="kl-b1" fill="{blade1}" d="M0 22 L30 22 L44 48.25 L44 81.3 Z"/>
  <path class="kl-b2" fill="{blade2}" d="M92 22 L62 22 L48 48.25 L48 81.3 Z"/>
  <path class="kl-st" fill="{stem}" d="M32 73 L46 92 L60 73 L60 122 L32 122 Z"/>
  <g class="kl-cap">
    <path fill="{cap}" d="M50 10 L77 0 L104 10 L77 20 Z"/>
    <path fill="{cap}" d="M62 14.5 L62 24 C70 29 84 29 92 24 L92 14.5 L77 20 Z"/>
    <path fill="none" stroke="{tassel}" stroke-width="2.2" stroke-linecap="round" d="M77 10 L102 11 L102 27"/>
    <rect fill="{tassel}" x="99.6" y="26" width="4.8" height="8" rx="1.6"/>
  </g>
</g>'''
def lockup(name,k,learn,dash,blade1,blade2,stem,cap,tassel,bg=None):
    b=f'<rect width="506" height="140" fill="{bg}"/>' if bg else ""
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 506 140" width="506" height="140" role="img" aria-label="Kayak Learn"><title>Kayak Learn</title>{b}
<g transform="translate(8 8)">{ident(blade1,blade2,stem,cap,tassel)}</g>
<g font-family="Archivo, 'Archivo Expanded', Arial, Helvetica, sans-serif" font-weight="800" font-size="62">
  <text class="kl-k" x="116" y="112" fill="{k}" textLength="178" lengthAdjust="spacingAndGlyphs">Kayak</text>
  <text class="kl-l" x="308" y="112" fill="{learn}" textLength="186" lengthAdjust="spacingAndGlyphs">Learn</text>
</g>
<rect class="kl-dash" x="310" y="124" width="44" height="7" fill="{dash}"/>
</svg>'''
    open(f"{OUT}/{name}.svg","w").write(svg)
lockup("KayakLearn_Logo_FullColour","#0E2F3C","#17807E","#EE9B1E","#17807E","#EE9B1E","#0E2F3C","#0E2F3C","#EE9B1E")
lockup("KayakLearn_Logo_Reversed","#FFFFFF","#5DB2AB","#EE9B1E","#5DB2AB","#EE9B1E","#FFFFFF","#FFFFFF","#F5C46D")
# square icon
icon=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Kayak Learn"><title>Kayak Learn</title>
<rect width="160" height="160" rx="34" fill="#0E2F3C"/><g transform="translate(26 14)">{ident("#5DB2AB","#EE9B1E","#FFFFFF","#FFFFFF","#F5C46D")}</g></svg>'''
open(f"{OUT}/KayakLearn_Icon.svg","w").write(icon)
fav=f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 116 134" width="116" height="134"><title>Kayak Learn</title>{ident("#17807E","#EE9B1E","#0E2F3C","#0E2F3C","#EE9B1E")}</svg>'''
open(f"{OUT}/KayakLearn_Mark.svg","w").write(fav)
