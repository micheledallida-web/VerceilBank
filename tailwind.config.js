/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  // Scan every fragment and script so no class you actually use gets purged
  content: [
    './index.html',
    './dashboard.html',
    './pages/**/*.html',
    './js/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      }
    }
  }
}
