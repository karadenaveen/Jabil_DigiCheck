/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jabil: {
          blue: "#00529B",
          dark: "#0F172A",
          teal: "#00A3E0",
          light: "#F0F4F8",
          card: "#FFFFFF",
          accent: "#2563EB",
          text: "#1E293B",
          subtext: "#64748B",
          border: "#E2E8F0"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
