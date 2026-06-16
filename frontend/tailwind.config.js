/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'navy-bg': '#0A1628',
        'navy-board': '#1B3A5C',
        'navy-miss': '#E8F4F8',
        'navy-hit': '#E63946',
        'navy-sunk': '#4A4A4A',
        'navy-ship': '#2D6A4F',
      },
      fontFamily: {
        naval: ['"Oswald"', '"Arial Narrow"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
