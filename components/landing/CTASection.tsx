/**
 * CTA Section with glitch text and floating money effects
 * Full-width dramatic call-to-action
 */

import { useEffect, useState } from 'react';

import { APP_STORE_URL, PLAY_STORE_URL } from '@/constants/app-stores';

// Floating money bill component
function FloatingMoney({ 
  delay, 
  left, 
  size, 
  duration 
}: { 
  delay: number; 
  left: string; 
  size: 'sm' | 'md' | 'lg';
  duration: number;
}) {
  const sizeClasses = {
    sm: 'w-8 h-4 text-[10px]',
    md: 'w-12 h-5 text-xs',
    lg: 'w-16 h-7 text-sm',
  };

  return (
    <div
      className={`absolute bottom-0 ${sizeClasses[size]} flex items-center justify-center rounded font-mono font-bold pointer-events-none`}
      style={{
        left,
        animation: `money-float ${duration}s ease-out infinite`,
        animationDelay: `${delay}s`,
        background: 'linear-gradient(135deg, #85bb65 0%, #4a7c38 100%)',
        color: '#2d4a1c',
        opacity: 0.5,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      $
    </div>
  );
}

export function CTASection() {
  const [moneyBills, setMoneyBills] = useState<{ id: number; delay: number; left: string; size: 'sm' | 'md' | 'lg'; duration: number }[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [glitchActive, setGlitchActive] = useState(false);

  // Generate floating money on mount
  useEffect(() => {
    const bills = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 10,
      left: `${2 + Math.random() * 96}%`,
      size: (['sm', 'md', 'lg'] as const)[Math.floor(Math.random() * 3)],
      duration: 5 + Math.random() * 4,
    }));
    setMoneyBills(bills);

    // Intersection observer for visibility
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById('cta-section');
    if (section) observer.observe(section);

    return () => observer.disconnect();
  }, []);

  // Periodic glitch effect
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitchActive(true);
      setTimeout(() => setGlitchActive(false), 300);
    }, 4000);

    return () => clearInterval(glitchInterval);
  }, []);

  const handleDownload = (store: 'ios' | 'android') => {
    window.open(store === 'ios' ? APP_STORE_URL : PLAY_STORE_URL, '_blank');
  };

  return (
    <section
      id="cta-section"
      className="relative min-h-[80vh] flex flex-col items-center justify-center overflow-hidden py-24 px-6"
    >
      {/* Dramatic gradient background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(255, 59, 48, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(191, 255, 0, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 122, 255, 0.1) 0%, transparent 60%),
            linear-gradient(180deg, #0A0A0A 0%, #18181b 50%, #0A0A0A 100%)
          `,
        }}
      />

      {/* Animated noise overlay */}
      <div className="bg-noise absolute inset-0" />

      {/* Floating gradient orbs */}
      <div 
        className="gradient-orb gradient-orb-red absolute w-[500px] h-[500px] top-0 left-1/4 opacity-40"
        style={{ animationDelay: '0s' }}
      />
      <div 
        className="gradient-orb gradient-orb-lime absolute w-[400px] h-[400px] bottom-0 right-1/4 opacity-30"
        style={{ animationDelay: '3s' }}
      />

      {/* Floating money background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {moneyBills.map((bill) => (
          <FloatingMoney key={bill.id} {...bill} />
        ))}
      </div>

      {/* Content container */}
      <div 
        className={`relative z-10 max-w-4xl mx-auto text-center transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
        }`}
      >
        {/* Glitch headline */}
        <h2 
          className={`font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.9] mb-8 ${
            glitchActive ? 'animate-glitch' : ''
          }`}
          style={{
            textShadow: glitchActive 
              ? '2px 0 #FF3B30, -2px 0 #BFFF00' 
              : '0 0 80px rgba(255, 59, 48, 0.3)',
          }}
        >
          <span className="text-white">Stop</span>
          <br />
          <span className="text-gradient-danger">lying</span>
          <br />
          <span className="text-white">to yourself</span>
        </h2>

        {/* Subheadline */}
        <p 
          className={`text-neutral-400 text-lg md:text-xl lg:text-2xl leading-relaxed mb-12 max-w-2xl mx-auto transition-all duration-1000 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          Download the app. Make one promise. Put{' '}
          <span className="font-mono text-lime-400 font-semibold">$5</span> on it.
          <br className="hidden sm:block" />
          See what happens when failure has a{' '}
          <span className="text-danger-500 font-medium">price</span>.
        </p>

        {/* CTA Buttons */}
        <div 
          className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-1000 delay-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <button
            onClick={() => handleDownload('ios')}
            className="px-10 py-4 text-lg font-bold rounded-xl bg-white text-black hover:bg-neutral-100 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            Download for iOS
          </button>
          
          <button
            onClick={() => handleDownload('android')}
            className="px-10 py-4 text-lg font-medium rounded-xl bg-transparent border border-neutral-600 text-white hover:border-lime-400/60 hover:bg-lime-400/10 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 15.34l1.612-2.791a.337.337 0 00-.124-.459.334.334 0 00-.458.124l-1.632 2.827a10.077 10.077 0 00-4.089-.861c-1.479 0-2.862.313-4.089.861l-1.632-2.827a.334.334 0 00-.458-.124.337.337 0 00-.124.459l1.612 2.791A9.652 9.652 0 003 22h18a9.652 9.652 0 00-3.477-6.66zM7 20a1 1 0 110-2 1 1 0 010 2zm10 0a1 1 0 110-2 1 1 0 010 2zM6.343 6.343A5.977 5.977 0 0112 4c2.21 0 4.21.895 5.657 2.343l1.414-1.414A7.972 7.972 0 0012 2a7.972 7.972 0 00-7.071 2.929l1.414 1.414z"/>
            </svg>
            Get for Android
          </button>
        </div>

        {/* Trust indicator */}
        <div 
          className={`mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-neutral-500 transition-all duration-1000 delay-600 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-lime-400 pulse-dot" />
            <span>Free to download</span>
          </div>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-neutral-700" />
          <div className="flex items-center gap-2">
            <span className="text-lg">🔒</span>
            <span>Secure payments via Stripe</span>
          </div>
          <div className="hidden sm:block w-1 h-1 rounded-full bg-neutral-700" />
          <div className="flex items-center gap-2">
            <span className="text-lg">💸</span>
            <span>You set your own stakes</span>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: 'linear-gradient(to top, #09090b, transparent)',
        }}
      />
    </section>
  );
}

