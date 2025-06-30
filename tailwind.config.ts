import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#A866FF",
      },
      fontFamily: {
        heading: ["Cift", "Playfair Display", "serif"],
        body: ["Reaktif", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
