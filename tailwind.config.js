/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./dashboard/**/*.{html,js}"],
  theme: {
    extend: {},
  },
  plugins: [
    require('@tailwindcss/typography')
  ],
}