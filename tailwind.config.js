/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0b0f19',
        cardBg: '#111827',
        borderCol: '#1f2937',
        bullGreen: '#10b981',
        bearRed: '#ef4444',
        accentGold: '#f59e0b',
        neutralBlue: '#3b82f6',
      }
    },
  },
  plugins: [],
}
