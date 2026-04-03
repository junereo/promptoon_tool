/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        editor: {
          bg: '#0f0f11',
          panel: '#17171b',
          panelAlt: '#1e1e24',
          border: '#30303a',
          accent: '#7a3040',
          accentSoft: '#a84b63'
        }
      },
      boxShadow: {
        phone: '0 20px 50px rgba(0, 0, 0, 0.45)'
      },
      fontFamily: {
        display: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        body: ['IBM Plex Sans', 'Segoe UI', 'sans-serif']
      }
    }
  },
  plugins: []
};

