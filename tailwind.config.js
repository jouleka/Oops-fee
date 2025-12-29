/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Primary: Electric lime/chartreuse - unexpected, attention-grabbing
        lime: {
          400: '#BFFF00',
          500: '#A8E600',
          600: '#8FCC00',
        },
        // Danger red for "failure" elements
        danger: {
          500: '#FF3B30',
          600: '#E6352B',
        },
        // iMessage blue for CTAs
        imessage: {
          500: '#007AFF',
          600: '#0066D6',
        },
        // Deep background
        abyss: {
          900: '#0A0A0A',
          800: '#121212',
          700: '#1A1A1A',
        },
      },
      fontFamily: {
        display: ['Archivo Black', 'system-ui', 'sans-serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'slide-up': 'slideUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'ticker': 'ticker 20s linear infinite',
        'shake': 'shake 0.5s ease-in-out',
        'shake-intense': 'shakeIntense 0.6s ease-in-out',
        'blink': 'blink 1s step-end infinite',
        'glitch': 'glitch 0.3s ease-in-out infinite',
        'flame': 'flameFlicker 0.5s ease-in-out infinite',
        'money-float': 'moneyFloat 3s ease-out forwards',
        'gradient-shift': 'gradientShift 15s ease infinite',
        'orb-float': 'orbFloat 8s ease-in-out infinite',
        'tombstone-rise': 'tombstoneRise 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'notification-slide': 'notificationSlide 4s ease-in-out',
        'pulse-ring': 'pulseRing 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scroll-indicator': 'scrollIndicator 2s ease-in-out infinite',
        'card-stack': 'cardStack 0.6s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(191, 255, 0, 0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(191, 255, 0, 0.6)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        shakeIntense: {
          '0%, 100%': { transform: 'translateX(0) rotate(0)' },
          '10%': { transform: 'translateX(-8px) rotate(-1deg)' },
          '20%': { transform: 'translateX(8px) rotate(1deg)' },
          '30%': { transform: 'translateX(-6px) rotate(-0.5deg)' },
          '40%': { transform: 'translateX(6px) rotate(0.5deg)' },
          '50%': { transform: 'translateX(-4px) rotate(0)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '51%, 100%': { opacity: '0' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)', textShadow: '0 0 0 transparent' },
          '20%': { transform: 'translate(-2px, 2px)', textShadow: '2px 0 #FF3B30, -2px 0 #00FF88' },
          '40%': { transform: 'translate(2px, -2px)', textShadow: '-2px 0 #FF3B30, 2px 0 #BFFF00' },
          '60%': { transform: 'translate(-1px, 1px)', textShadow: '1px 0 #007AFF, -1px 0 #FF3B30' },
          '80%': { transform: 'translate(1px, -1px)', textShadow: '-1px 0 #BFFF00, 1px 0 #007AFF' },
        },
        flameFlicker: {
          '0%, 100%': { transform: 'scaleY(1) scaleX(1)', filter: 'brightness(1)' },
          '25%': { transform: 'scaleY(1.1) scaleX(0.95)', filter: 'brightness(1.1)' },
          '50%': { transform: 'scaleY(0.95) scaleX(1.05)', filter: 'brightness(0.95)' },
          '75%': { transform: 'scaleY(1.05) scaleX(0.98)', filter: 'brightness(1.05)' },
        },
        moneyFloat: {
          '0%': { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
          '100%': { opacity: '0', transform: 'translateY(-100px) rotate(15deg)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        orbFloat: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)', opacity: '0.6' },
          '33%': { transform: 'translate(30px, -20px) scale(1.1)', opacity: '0.8' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)', opacity: '0.5' },
        },
        tombstoneRise: {
          '0%': { transform: 'translateY(100%) rotate(-5deg)', opacity: '0' },
          '60%': { transform: 'translateY(-10%) rotate(2deg)' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        },
        notificationSlide: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '10%': { transform: 'translateX(0)', opacity: '1' },
          '90%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        pulseRing: {
          '0%': { transform: 'scale(1)', opacity: '0.8' },
          '100%': { transform: 'scale(1.5)', opacity: '0' },
        },
        scrollIndicator: {
          '0%, 100%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(8px)', opacity: '0.5' },
        },
        cardStack: {
          '0%': { transform: 'translateY(40px) scale(0.95)', opacity: '0' },
          '100%': { transform: 'translateY(0) scale(1)', opacity: '1' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        oopsfee: {
          'primary': '#BFFF00',
          'primary-content': '#0A0A0A',
          'secondary': '#007AFF',
          'secondary-content': '#FFFFFF',
          'accent': '#FF3B30',
          'accent-content': '#FFFFFF',
          'neutral': '#1A1A1A',
          'neutral-content': '#FFFFFF',
          'base-100': '#0A0A0A',
          'base-200': '#121212',
          'base-300': '#1A1A1A',
          'base-content': '#FFFFFF',
          'info': '#007AFF',
          'success': '#34C759',
          'warning': '#FF9500',
          'error': '#FF3B30',
        },
      },
    ],
    darkTheme: 'oopsfee',
  },
};

