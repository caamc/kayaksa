KAYAK STRATEGIC ADVISORS - DESIGN TOKENS v1.0 (October 2026)
Companion to the KSA Design & Visual Guidelines (section 07 UI assets, section 06 data visualisation).

ksa-tokens.css            CSS custom properties. Light by default; add data-theme="dark" to <html> for the dark theme.
ksa-tokens.json           Same tokens in W3C design-tokens format, for Figma Tokens Studio, Style Dictionary etc.
ksa-echarts-theme-light/dark.json   Apache ECharts themes: echarts.registerTheme('ksa', json)
ksa-powerbi-theme.json    Power BI report theme: View > Themes > Browse for themes
ksa.mplstyle              Python matplotlib style for analysts: plt.style.use('ksa.mplstyle')

Rules that tokens alone cannot enforce:
- One Beacon Saffron (#EE9B1E) highlight per chart or view. It is never a series colour in the cycle.
- Bars start at zero; no pies, 3D or dual axes; max 12 bars, 6 lines, 5 donut segments.
- Saffron, Riverstone and Estuary Sand fail contrast as text on white: label them in Deep Current or Storm Slate.
- Use tokens by role (color.action.primary), never raw hex in product code.
