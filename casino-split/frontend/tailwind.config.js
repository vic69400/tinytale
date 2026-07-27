/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          950: "#07130f",
          900: "#0b1f18",
          800: "#123528",
        },
        gold: {
          400: "#f2c744",
          500: "#e0ac1f",
        },
      },
    },
  },
  plugins: [],
};
