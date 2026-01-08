/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light theme inspired by observability tools
        surface: {
          0: '#ffffff',
          1: '#f8fafc',
          2: '#f1f5f9',
          3: '#e2e8f0',
          4: '#cbd5e1',
        },
        accent: {
          primary: '#6366f1',    // Indigo
          success: '#22c55e',    // Green
          warning: '#f59e0b',    // Amber
          danger: '#ef4444',     // Red
          info: '#3b82f6',       // Blue
        },
        text: {
          primary: '#0f172a',
          secondary: '#475569',
          muted: '#94a3b8',
        }
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
    },
  },
  plugins: [],
}
