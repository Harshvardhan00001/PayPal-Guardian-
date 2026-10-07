/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paypal: {
          blue: '#0070BA',
          darkBlue: '#003087',
          lightBlue: '#00CFDE',
          navy: '#0C2340',
        },
        guardian: {
          primary: '#4F46E5',
          accent: '#10B981',
          danger: '#EF4444',
          warning: '#F59E0B',
          dark: '#0F172A',
          card: '#1E293B'
        }
      },
    },
  },
  plugins: [],
}
