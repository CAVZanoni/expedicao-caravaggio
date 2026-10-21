/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        strava: {
          orange: "#fc4c02",
          dark: "#242428",
          gray: "#dfdfdf",
          bg: "#0f172a"
        }
      }
    },
  },
  plugins: [],
}
