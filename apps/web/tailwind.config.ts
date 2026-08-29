import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0F',
        ink: '#F4F1EA',
        muted: '#A8A29E',
        amber: {
          DEFAULT: '#D4A574',
          soft: '#B8915E',
        },
        crimson: '#8B2635',
        rust: '#C44536',
        moss: '#5C8068',
      },
      fontFamily: {
        serif: ['"IBM Plex Serif"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        breath: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        filmroll: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0,0)' },
          '10%': { transform: 'translate(-5%,-5%)' },
          '20%': { transform: 'translate(-10%,5%)' },
          '30%': { transform: 'translate(5%,-10%)' },
          '40%': { transform: 'translate(-5%,15%)' },
          '50%': { transform: 'translate(-10%,5%)' },
          '60%': { transform: 'translate(15%,0)' },
          '70%': { transform: 'translate(0,10%)' },
          '80%': { transform: 'translate(-15%,0)' },
          '90%': { transform: 'translate(10%,5%)' },
        },
      },
      animation: {
        breath: 'breath 3s ease-in-out infinite',
        pulse: 'pulse 1.2s ease-in-out infinite',
        filmroll: 'filmroll 4s linear infinite',
        grain: 'grain 8s steps(10) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
