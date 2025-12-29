/**
 * How It Works Section
 * Stacking cards with scroll-driven animations and progress indicator
 */

import { useEffect, useRef, useState } from 'react';

const STEPS = [
  {
    number: 1,
    title: 'Make your promise',
    description:
      'Type it. Record it with your voice. Pick a deadline. Choose how you\'ll prove completion.',
    animation: 'typing',
    emoji: '✍️',
    accentColor: 'lime',
  },
  {
    number: 2,
    title: 'Set your stakes',
    description:
      '$5, $25, $100 — whatever makes you uncomfortable enough to actually follow through.',
    animation: 'money',
    emoji: '💸',
    accentColor: 'lime',
  },
  {
    number: 3,
    title: 'Prove it or lose it',
    description:
      'Complete with photo proof, friend verification, or health data. No proof by deadline? Money\'s gone.',
    animation: 'result',
    emoji: '🔥',
    accentColor: 'danger',
  },
];

// Typing animation component
function TypingAnimation() {
  const [text, setText] = useState('');
  const fullText = 'Go to the gym 3x a week';
  
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < fullText.length) {
        setText(fullText.slice(0, index + 1));
        index++;
      } else {
        // Reset after a pause
        setTimeout(() => {
          setText('');
          index = 0;
        }, 2000);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-neutral-800/80 rounded-xl p-4 border border-neutral-700 min-h-[60px] flex items-center">
      <span className="text-white font-medium">{text}</span>
      <span className="inline-block w-0.5 h-5 bg-lime-400 ml-1 animate-blink" />
    </div>
  );
}

// Money sliding animation component
function MoneyAnimation() {
  const [amount, setAmount] = useState(0);
  
  useEffect(() => {
    const targetAmount = 25;
    const duration = 1500;
    const steps = 30;
    const increment = targetAmount / steps;
    let current = 0;
    
    const interval = setInterval(() => {
      current += increment;
      if (current >= targetAmount) {
        setAmount(targetAmount);
        // Reset after pause
        setTimeout(() => setAmount(0), 3000);
      } else {
        setAmount(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Wallet visualization */}
      <div className="bg-neutral-800/80 rounded-xl p-4 border border-neutral-700 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-lime-400 to-lime-600 flex items-center justify-center">
            <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-neutral-400 text-sm">Stake amount</p>
            <p className="text-white font-mono text-2xl font-bold">
              ${amount.toFixed(0)}
            </p>
          </div>
        </div>
        
        {/* Animated coins falling */}
        <div className="relative w-16 h-16 overflow-hidden">
          {[...Array(3)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-300 flex items-center justify-center text-xs font-bold text-yellow-900"
              style={{
                animation: `money-float 2s ease-in-out ${i * 0.3}s infinite reverse`,
                left: `${i * 16}px`,
                bottom: '-24px',
              }}
            >
              $
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Result animation component (confetti/fire)
function ResultAnimation() {
  const [showSuccess, setShowSuccess] = useState(true);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setShowSuccess(prev => !prev);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      <div className={`bg-neutral-800/80 rounded-xl p-4 border transition-colors duration-500 ${
        showSuccess ? 'border-lime-500/50' : 'border-red-500/50'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-neutral-400 text-sm mb-1">Status</p>
            <p className={`font-bold text-lg transition-colors duration-500 ${
              showSuccess ? 'text-lime-400' : 'text-red-400'
            }`}>
              {showSuccess ? '✓ Promise Kept!' : '✗ Time\'s Up!'}
            </p>
          </div>
          
          {/* Animated result indicator */}
          <div className="relative w-16 h-16 flex items-center justify-center">
            {showSuccess ? (
              // Confetti effect
              <div className="relative">
                <span className="text-4xl">🎉</span>
                {['✨', '🌟', '⭐'].map((emoji, i) => (
                  <span 
                    key={i}
                    className="absolute text-lg animate-parallax"
                    style={{
                      top: `${-10 + i * 10}px`,
                      left: `${-10 + i * 15}px`,
                      animationDelay: `${i * 200}ms`,
                    }}
                  >
                    {emoji}
                  </span>
                ))}
              </div>
            ) : (
              // Fire effect
              <div className="relative">
                <div className="flame scale-75" />
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-2xl">💀</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Money indicator */}
        <div className={`mt-3 pt-3 border-t transition-colors duration-500 ${
          showSuccess ? 'border-lime-500/20' : 'border-red-500/20'
        }`}>
          <p className={`font-mono text-sm ${showSuccess ? 'text-lime-400' : 'text-red-400'}`}>
            {showSuccess ? '+$25 returned' : '-$25 burned 🔥'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Individual step card
function StepCard({ 
  step, 
  index, 
  isActive, 
  isCompleted 
}: { 
  step: typeof STEPS[0]; 
  index: number;
  isActive: boolean;
  isCompleted: boolean;
}) {
  return (
    <div 
      className={`
        relative rounded-2xl p-6 md:p-8 transition-all duration-500 ease-out
        border backdrop-blur-sm
        ${isActive 
          ? 'bg-neutral-800/90 border-lime-500/30 shadow-2xl shadow-lime-500/10 scale-100 z-30' 
          : isCompleted 
            ? 'bg-neutral-800/60 border-neutral-700/50 scale-95 opacity-70 z-10' 
            : 'bg-neutral-800/40 border-neutral-700/30 scale-90 opacity-50 z-0'
        }
      `}
      style={{
        transform: isActive 
          ? 'translateY(0) scale(1)' 
          : isCompleted 
            ? `translateY(${-20 * (2 - index)}px) scale(0.95)` 
            : `translateY(${20 * (index - 1)}px) scale(0.9)`,
      }}
    >
      {/* Step number badge */}
      <div className="flex items-start gap-5">
        <div className={`
          flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
          font-display text-xl font-bold transition-colors duration-300
          ${isActive 
            ? 'bg-lime-400 text-black' 
            : isCompleted 
              ? 'bg-lime-400/20 text-lime-400' 
              : 'bg-neutral-700 text-neutral-400'
          }
        `}>
          {isCompleted ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step.number
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`
            font-display text-xl md:text-2xl font-bold mb-2 transition-colors duration-300
            ${isActive ? 'text-white' : 'text-neutral-300'}
          `}>
            {step.title}
          </h3>
          <p className={`
            text-base leading-relaxed transition-colors duration-300
            ${isActive ? 'text-neutral-300' : 'text-neutral-500'}
          `}>
            {step.description}
          </p>
          
          {/* Animation preview - only show when active */}
          {isActive && (
            <div className="mt-6 animate-fade-in">
              {step.animation === 'typing' && <TypingAnimation />}
              {step.animation === 'money' && <MoneyAnimation />}
              {step.animation === 'result' && <ResultAnimation />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Intersection observer for section reveal
    const revealObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsRevealed(true);
        }
      },
      { threshold: 0.2 }
    );
    revealObserver.observe(section);

    // Scroll handler for step progression
    const handleScroll = () => {
      const rect = section.getBoundingClientRect();
      const sectionHeight = rect.height;
      const viewportHeight = window.innerHeight;
      
      // Calculate scroll progress through the section
      const scrollProgress = Math.max(0, Math.min(1, 
        (viewportHeight - rect.top) / (sectionHeight + viewportHeight * 0.5)
      ));
      
      // Map progress to step index
      const newStep = Math.floor(scrollProgress * STEPS.length);
      setActiveStep(Math.min(newStep, STEPS.length - 1));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => {
      revealObserver.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <section 
      ref={sectionRef}
      className="relative py-24 md:py-32 px-6 md:px-12 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-abyss-900 via-neutral-900/50 to-abyss-900" />
      
      {/* Subtle grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Section header */}
        <div className={`text-center mb-16 md:mb-20 transition-all duration-700 ${
          isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          <span className="inline-block text-lime-400 text-xs font-mono uppercase tracking-[0.3em] mb-4">
            How it works
          </span>
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Three steps.
            <br />
            <span className="text-gradient-lime">No loopholes.</span>
          </h2>
        </div>

        {/* Steps container with progress */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Progress indicator - vertical on mobile, side on desktop */}
          <div className={`
            hidden lg:flex flex-col items-center gap-0 pt-8
            transition-all duration-700 delay-200
            ${isRevealed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}
          `}>
            {STEPS.map((_, i) => (
              <div key={i} className="flex flex-col items-center">
                {/* Step dot */}
                <div className={`
                  w-4 h-4 rounded-full transition-all duration-300 relative
                  ${activeStep >= i 
                    ? 'bg-lime-400' 
                    : 'bg-neutral-700'
                  }
                `}>
                  {activeStep === i && (
                    <div className="absolute inset-0 rounded-full bg-lime-400 animate-pulse-ring" />
                  )}
                </div>
                
                {/* Connector line */}
                {i < STEPS.length - 1 && (
                  <div className="relative w-0.5 h-32 bg-neutral-700 overflow-hidden">
                    <div 
                      className="absolute top-0 left-0 w-full bg-lime-400 transition-all duration-500 ease-out"
                      style={{
                        height: activeStep > i ? '100%' : activeStep === i ? '50%' : '0%',
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile progress bar */}
          <div className={`
            lg:hidden flex items-center gap-3 mb-4
            transition-all duration-700 delay-200
            ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
          `}>
            {STEPS.map((_, i) => (
              <div key={i} className="flex-1 flex items-center gap-3">
                <div className={`
                  w-3 h-3 rounded-full transition-all duration-300
                  ${activeStep >= i ? 'bg-lime-400' : 'bg-neutral-700'}
                `} />
                {i < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 bg-neutral-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-lime-400 transition-all duration-500"
                      style={{ width: activeStep > i ? '100%' : '0%' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Cards stack */}
          <div className="flex-1 relative">
            <div className="space-y-6">
              {STEPS.map((step, i) => (
                <div 
                  key={i}
                  className={`transition-all duration-700 ${
                    isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                  }`}
                  style={{ transitionDelay: `${300 + i * 150}ms` }}
                >
                  <StepCard 
                    step={step} 
                    index={i}
                    isActive={activeStep === i}
                    isCompleted={activeStep > i}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className={`
          mt-16 flex justify-center transition-all duration-700 delay-700
          ${isRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}
        `}>
          <div className="flex items-center gap-3 text-neutral-500 text-sm">
            <span className="font-mono text-lime-400/60">{'///'}</span>
            <span>That&apos;s it. Simple and brutal.</span>
            <span className="font-mono text-lime-400/60">{'///'}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

