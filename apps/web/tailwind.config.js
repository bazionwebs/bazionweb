/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy:    { DEFAULT: '#0F172A', 50: '#f8fafc', 100: '#f1f5f9', 900: '#0F172A' },
        blue:    { DEFAULT: '#2563EB', light: '#3B82F6', dark: '#1D4ED8' },
        teal:    { DEFAULT: '#14B8A6', light: '#2DD4BF', dark: '#0F9488' },
        success: '#22C55E',
        warning: '#F59E0B',
        danger:  '#EF4444',
        brand: {
          primary:   '#0F172A',
          secondary: '#2563EB',
          accent:    '#14B8A6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-2xl': ['4.5rem',  { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-xl':  ['3.75rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-lg':  ['3rem',    { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-md':  ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        'display-sm':  ['1.875rem',{ lineHeight: '1.3' }],
        'display-xs':  ['1.5rem',  { lineHeight: '1.3' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'card':    '0 1px 3px 0 rgba(15,23,42,0.06), 0 1px 2px -1px rgba(15,23,42,0.06)',
        'card-md': '0 4px 6px -1px rgba(15,23,42,0.07), 0 2px 4px -2px rgba(15,23,42,0.07)',
        'card-lg': '0 10px 15px -3px rgba(15,23,42,0.07), 0 4px 6px -4px rgba(15,23,42,0.07)',
        'card-xl': '0 20px 25px -5px rgba(15,23,42,0.08), 0 8px 10px -6px rgba(15,23,42,0.08)',
        'glow-blue': '0 0 0 3px rgba(37,99,235,0.15)',
        'glow-teal': '0 0 0 3px rgba(20,184,166,0.15)',
      },
      animation: {
        'fade-in':       'fadeIn 0.5s ease-out',
        'fade-up':       'fadeUp 0.6s ease-out',
        'slide-in-left': 'slideInLeft 0.5s ease-out',
        'pulse-slow':    'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float':         'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:      { '0%': { opacity: '0' },                       '100%': { opacity: '1' } },
        fadeUp:      { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-20px)' },'100%': { opacity: '1', transform: 'translateX(0)' } },
        float:       { '0%,100%': { transform: 'translateY(0px)' },  '50%': { transform: 'translateY(-10px)' } },
      },
      backgroundImage: {
        'gradient-radial':   'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient':     'linear-gradient(135deg, #0F172A 0%, #1e3a5f 50%, #0F172A 100%)',
        'card-gradient':     'linear-gradient(135deg, rgba(37,99,235,0.05) 0%, rgba(20,184,166,0.05) 100%)',
        'teal-gradient':     'linear-gradient(135deg, #14B8A6 0%, #2563EB 100%)',
        'blue-gradient':     'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
