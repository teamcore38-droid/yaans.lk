/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        yaans: {
          white: '#FFFFFF',
          bg: '#F3F4F6',
          surface: '#F8FAFC',
          border: '#E2E8F0',
          slate: '#0F172A',
          charcoal: '#1E293B',
          muted: '#475569',
          cta: '#F59E0B',
          ctaHover: '#D97706',
          link: '#0284C7',
          linkHover: '#0369A1',
          success: '#15803D'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif']
      }
    }
  },
  plugins: []
};
