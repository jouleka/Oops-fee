/**
 * FeatureCard - 3D tilt cards with unique micro-animations
 * Each feature type has its own distinctive animation
 */

import { useCallback, useRef, useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type FeatureType = 'voice' | 'photo' | 'friend' | 'graveyard';

interface FeatureCardProps {
  type: FeatureType;
  title: string;
  description: string;
  index: number;
}

// ─────────────────────────────────────────────────────────────
// MICRO-ANIMATION COMPONENTS
// ─────────────────────────────────────────────────────────────

function VoiceAnimation({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Mic icon */}
      <div className="absolute text-4xl z-10 transition-transform duration-300"
        style={{ transform: isHovered ? 'scale(1.1)' : 'scale(1)' }}>
        🎙️
      </div>
      {/* Waveform bars behind */}
      <div 
        className="absolute inset-0 flex items-center justify-center gap-1 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        {[...Array(7)].map((_, i) => (
          <div
            key={i}
            className="waveform-bar bg-lime-400"
            style={{
              animationPlayState: isHovered ? 'running' : 'paused',
              opacity: 0.6,
            }}
          />
        ))}
      </div>
      {/* Pulse rings */}
      {isHovered && (
        <>
          <div className="absolute w-16 h-16 rounded-full border-2 border-lime-400/30 animate-pulse-ring" />
          <div className="absolute w-16 h-16 rounded-full border-2 border-lime-400/20 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
        </>
      )}
    </div>
  );
}

function PhotoAnimation({ isHovered }: { isHovered: boolean }) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (isHovered) {
      const timer = setTimeout(() => setFlash(true), 200);
      const clearTimer = setTimeout(() => setFlash(false), 500);
      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
    return undefined;
  }, [isHovered]);

  return (
    <div className="relative w-20 h-20 flex items-center justify-center overflow-hidden">
      {/* Camera icon */}
      <div 
        className="text-4xl z-10 transition-all duration-200"
        style={{ 
          transform: isHovered ? 'scale(0.9)' : 'scale(1)',
        }}
      >
        📸
      </div>
      {/* Flash effect */}
      <div 
        className="absolute inset-0 bg-white rounded-full transition-opacity duration-100"
        style={{ 
          opacity: flash ? 0.9 : 0,
          transform: 'scale(2)',
          filter: 'blur(10px)',
        }}
      />
      {/* Shutter lines */}
      {isHovered && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-full h-0.5 bg-white/20 animate-shutter origin-center" />
          <div className="absolute w-0.5 h-full bg-white/20 animate-shutter origin-center" style={{ animationDelay: '0.1s' }} />
        </div>
      )}
      {/* Corner focus brackets */}
      <div 
        className="absolute inset-3 pointer-events-none transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0 }}
      >
        <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-lime-400" />
        <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-lime-400" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-lime-400" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-lime-400" />
      </div>
    </div>
  );
}

function FriendAnimation({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Two avatars that connect on hover */}
      <div className="flex items-center">
        <div 
          className="w-10 h-10 rounded-full bg-gradient-to-br from-imessage-500 to-imessage-600 flex items-center justify-center text-lg shadow-lg transition-all duration-500 z-10"
          style={{ 
            transform: isHovered ? 'translateX(8px)' : 'translateX(-4px)',
          }}
        >
          👤
        </div>
        <div 
          className="w-10 h-10 rounded-full bg-gradient-to-br from-lime-400 to-lime-500 flex items-center justify-center text-lg shadow-lg transition-all duration-500 -ml-2"
          style={{ 
            transform: isHovered ? 'translateX(-8px)' : 'translateX(4px)',
          }}
        >
          👤
        </div>
      </div>
      {/* Connection line */}
      <div 
        className="absolute h-0.5 bg-gradient-to-r from-imessage-500 to-lime-400 transition-all duration-500 rounded-full"
        style={{
          width: isHovered ? '0px' : '20px',
          opacity: isHovered ? 0 : 0.6,
        }}
      />
      {/* Connection spark */}
      {isHovered && (
        <div className="absolute">
          <div className="absolute -inset-1 animate-pulse-ring">
            <div className="w-6 h-6 rounded-full bg-lime-400/40" />
          </div>
          <div className="text-xl">✨</div>
        </div>
      )}
      {/* Check mark on connect */}
      <div 
        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-xs transition-all duration-300"
        style={{
          transform: isHovered ? 'scale(1)' : 'scale(0)',
          opacity: isHovered ? 1 : 0,
        }}
      >
        ✓
      </div>
    </div>
  );
}

function GraveyardAnimation({ isHovered }: { isHovered: boolean }) {
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      {/* Ground line */}
      <div className="absolute bottom-2 left-0 right-0 h-0.5 bg-neutral-600 rounded-full" />
      
      {/* Tombstone that rises */}
      <div 
        className="relative transition-all duration-700 ease-out"
        style={{
          transform: isHovered 
            ? 'translateY(0) rotate(0deg)' 
            : 'translateY(20px) rotate(-8deg)',
          opacity: isHovered ? 1 : 0.5,
        }}
      >
        <div className="text-4xl" style={{ filter: isHovered ? 'none' : 'grayscale(0.5)' }}>
          🪦
        </div>
        {/* RIP text that appears */}
        <div 
          className="absolute -top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-danger-500 font-bold tracking-wider transition-all duration-500"
          style={{
            opacity: isHovered ? 1 : 0,
            transform: isHovered ? 'translateY(0)' : 'translateY(5px)',
          }}
        >
          R.I.P
        </div>
      </div>
      
      {/* Floating ghost on hover */}
      <div 
        className="absolute -top-2 -right-2 text-xl transition-all duration-500"
        style={{
          opacity: isHovered ? 0.7 : 0,
          transform: isHovered ? 'translateY(-5px) translateX(0)' : 'translateY(10px) translateX(-10px)',
        }}
      >
        👻
      </div>
      
      {/* Fog/mist effect */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral-700/40 to-transparent rounded-full transition-opacity duration-500"
        style={{ 
          opacity: isHovered ? 1 : 0,
          filter: 'blur(4px)',
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export function FeatureCard({ type, title, description, index }: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tiltStyle, setTiltStyle] = useState({});
  const [isVisible, setIsVisible] = useState(false);

  // Intersection observer for scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // 3D tilt effect on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation (max 12 degrees)
    const rotateX = ((y - centerY) / centerY) * -12;
    const rotateY = ((x - centerX) / centerX) * 12;

    // Calculate highlight position
    const highlightX = (x / rect.width) * 100;
    const highlightY = (y / rect.height) * 100;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`,
      '--highlight-x': `${highlightX}%`,
      '--highlight-y': `${highlightY}%`,
    } as React.CSSProperties);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setTiltStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)',
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // Get animation component based on type
  const AnimationComponent = {
    voice: VoiceAnimation,
    photo: PhotoAnimation,
    friend: FriendAnimation,
    graveyard: GraveyardAnimation,
  }[type];

  // Get accent color based on type
  const accentColors = {
    voice: 'from-lime-400/20 to-lime-400/5',
    photo: 'from-imessage-500/20 to-imessage-500/5',
    friend: 'from-green-500/20 to-green-500/5',
    graveyard: 'from-danger-500/20 to-danger-500/5',
  };

  const borderColors = {
    voice: 'group-hover:border-lime-400/40',
    photo: 'group-hover:border-imessage-500/40',
    friend: 'group-hover:border-green-500/40',
    graveyard: 'group-hover:border-danger-500/40',
  };

  const glowColors = {
    voice: 'rgba(191, 255, 0, 0.15)',
    photo: 'rgba(0, 122, 255, 0.15)',
    friend: 'rgba(52, 199, 89, 0.15)',
    graveyard: 'rgba(255, 59, 48, 0.15)',
  };

  return (
    <div
      ref={cardRef}
      className={`
        group relative w-full sm:w-[calc(50%-12px)] lg:w-[calc(25%-18px)]
        transition-all duration-500 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}
      `}
      style={{
        transitionDelay: `${index * 100}ms`,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`
          relative h-full p-6 rounded-2xl
          bg-gradient-to-br from-neutral-800/80 to-neutral-900/80
          border border-neutral-700/50 ${borderColors[type]}
          backdrop-blur-sm
          transition-all duration-300 ease-out
          will-change-transform
        `}
        style={{
          ...tiltStyle,
          boxShadow: isHovered 
            ? `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 60px ${glowColors[type]}`
            : '0 10px 30px -10px rgba(0,0,0,0.3)',
        }}
      >
        {/* Gradient overlay that follows mouse */}
        <div 
          className={`
            absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100
            bg-gradient-radial ${accentColors[type]}
            transition-opacity duration-300 pointer-events-none
          `}
          style={{
            background: isHovered 
              ? `radial-gradient(circle at var(--highlight-x, 50%) var(--highlight-y, 50%), ${glowColors[type]}, transparent 50%)`
              : undefined,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center gap-4">
          {/* Animated visual */}
          <AnimationComponent isHovered={isHovered} />

          {/* Title */}
          <h3 className="text-lg font-semibold text-white tracking-tight">
            {title}
          </h3>

          {/* Description */}
          <p className="text-sm text-neutral-400 leading-relaxed">
            {description}
          </p>
        </div>

        {/* Bottom accent line */}
        <div 
          className={`
            absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 rounded-full
            transition-all duration-500 ease-out
            ${type === 'voice' ? 'bg-lime-400' : ''}
            ${type === 'photo' ? 'bg-imessage-500' : ''}
            ${type === 'friend' ? 'bg-green-500' : ''}
            ${type === 'graveyard' ? 'bg-danger-500' : ''}
          `}
          style={{
            width: isHovered ? '60%' : '0%',
            opacity: isHovered ? 0.8 : 0,
          }}
        />
      </div>
    </div>
  );
}

