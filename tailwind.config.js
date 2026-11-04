/**
 * Tailwind reads its colour, type, spacing, radius, shadow, z index and motion
 * scales straight from the CSS custom properties in css/tokens.css. That is
 * what lets a club theme swap without a rebuild or a class change.
 */

const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  white: '#FFFFFF',
  black: '#000000',
  background: 'var(--colorBackground)',
  surface: 'var(--colorSurface)',
  surfaceRaised: 'var(--colorSurfaceRaised)',
  line: 'var(--colorLine)',
  text: 'var(--colorText)',
  textMuted: 'var(--colorTextMuted)',
  primary: 'var(--colorPrimary)',
  primaryContrast: 'var(--colorPrimaryContrast)',
  accent: 'var(--colorAccent)',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    colors,
    borderColor: {
      DEFAULT: 'var(--colorLine)',
      ...colors,
    },
    ringColor: {
      DEFAULT: 'var(--colorAccent)',
      ...colors,
    },
    outlineColor: {
      ...colors,
    },
    fontFamily: {
      display: 'var(--fontDisplay)',
      body: 'var(--fontBody)',
      sans: 'var(--fontBody)',
    },
    fontSize: {
      xs: ['var(--textXs)', { lineHeight: 'var(--leadingNormal)' }],
      sm: ['var(--textSm)', { lineHeight: 'var(--leadingNormal)' }],
      base: ['var(--textBase)', { lineHeight: 'var(--leadingNormal)' }],
      lg: ['var(--textLg)', { lineHeight: 'var(--leadingRelaxed)' }],
      xl: ['var(--textXl)', { lineHeight: 'var(--leadingSnug)' }],
      '2xl': ['var(--text2xl)', { lineHeight: 'var(--leadingSnug)' }],
      '3xl': ['var(--text3xl)', { lineHeight: 'var(--leadingTight)' }],
      displaySm: ['var(--textDisplaySm)', { lineHeight: 'var(--leadingTight)', letterSpacing: 'var(--trackingTight)' }],
      displayMd: ['var(--textDisplayMd)', { lineHeight: 'var(--leadingTight)', letterSpacing: 'var(--trackingTight)' }],
      displayLg: ['var(--textDisplayLg)', { lineHeight: 'var(--leadingTight)', letterSpacing: 'var(--trackingTight)' }],
    },
    lineHeight: {
      tight: 'var(--leadingTight)',
      snug: 'var(--leadingSnug)',
      normal: 'var(--leadingNormal)',
      relaxed: 'var(--leadingRelaxed)',
    },
    letterSpacing: {
      tight: 'var(--trackingTight)',
      normal: 'var(--trackingNormal)',
      wide: 'var(--trackingWide)',
      wider: 'var(--trackingWider)',
    },
    spacing: {
      0: '0px',
      px: '1px',
      1: 'var(--space1)',
      2: 'var(--space2)',
      3: 'var(--space3)',
      4: 'var(--space4)',
      5: 'var(--space5)',
      6: 'var(--space6)',
      8: 'var(--space8)',
      10: 'var(--space10)',
      12: 'var(--space12)',
      16: 'var(--space16)',
      20: 'var(--space20)',
      24: 'var(--space24)',
    },
    borderRadius: {
      none: '0px',
      sharp: 'var(--radiusSharp)',
      soft: 'var(--radiusSoft)',
      pill: 'var(--radiusPill)',
      full: '9999px',
    },
    borderWidth: {
      DEFAULT: 'var(--borderWidth1)',
      0: '0px',
      1: 'var(--borderWidth1)',
      2: 'var(--borderWidth2)',
      3: 'var(--borderWidth3)',
    },
    boxShadow: {
      none: 'none',
      flat: 'var(--shadowFlat)',
      raised: 'var(--shadowRaised)',
    },
    zIndex: {
      base: 'var(--zBase)',
      raised: 'var(--zRaised)',
      overlay: 'var(--zOverlay)',
      toast: 'var(--zToast)',
    },
    transitionDuration: {
      fast: 'var(--durationFast)',
      normal: 'var(--durationNormal)',
      slow: 'var(--durationSlow)',
    },
    transitionTimingFunction: {
      standard: 'var(--easeStandard)',
      out: 'var(--easeOut)',
    },
    extend: {},
  },
  plugins: [],
};