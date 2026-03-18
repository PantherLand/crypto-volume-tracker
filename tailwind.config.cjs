/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#09111b',
        night: '#07101a',
        amber: '#ffb84d',
        sand: '#eee5d4',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'sans-serif'],
        heading: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 24px 80px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
