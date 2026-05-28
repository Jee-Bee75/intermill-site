import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import HeroVideo from './HeroVideo';

const socials = [
  { label: 'Twitter', href: '#' },
  { label: 'LinkedIn', href: '#' },
  { label: 'Dribbble', href: '#' },
  { label: 'GitHub', href: '#' },
];

const MARQUEE_TEXT = 'BUILDING THE FUTURE • ';

export default function Footer() {
  const marqueeRef = useRef<HTMLDivElement>(null);
  const track = Array(10).fill(MARQUEE_TEXT).join('');

  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return undefined;

    const anim = gsap.to(el, {
      xPercent: -50,
      duration: 40,
      ease: 'none',
      repeat: -1,
    });

    return () => { anim.kill(); };
  }, []);

  return (
    <footer
      id="contact"
      className="relative overflow-hidden pt-16 md:pt-20 pb-8 md:pb-12"
      style={{ backgroundColor: 'hsl(0 0% 4%)' }}
    >
      {/* Background flipped video */}
      <div className="absolute inset-0">
        <HeroVideo flipY />
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
      </div>

      <div className="relative z-10">
        {/* Marquee */}
        <div className="overflow-hidden mb-16 md:mb-20">
          <div ref={marqueeRef} className="whitespace-nowrap inline-block">
            <span
              className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight"
              style={{
                fontFamily: "'Instrument Serif', serif",
                color: 'hsl(0 0% 96% / 0.15)',
              }}
            >
              {track}{track}
            </span>
          </div>
        </div>

        {/* CTA */}
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 flex flex-col items-center text-center mb-16 md:mb-20">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px" style={{ backgroundColor: 'hsl(0 0% 12%)' }} />
            <span className="text-xs uppercase tracking-[0.3em]" style={{ color: 'hsl(0 0% 53%)' }}>
              Get in touch
            </span>
            <span className="w-8 h-px" style={{ backgroundColor: 'hsl(0 0% 12%)' }} />
          </div>

          <h2
            className="text-4xl md:text-6xl lg:text-7xl font-light mb-8 max-w-2xl"
            style={{ color: 'hsl(0 0% 96%)' }}
          >
            Let's build something{' '}
            <em
              className="font-normal"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              great
            </em>{' '}
            together.
          </h2>

          {/* Email CTA */}
          <div className="relative group">
            <span
              className="absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                inset: -2,
                background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
                borderRadius: 9999,
                zIndex: 0,
              }}
            />
            <a
              href="mailto:hello@michaelsmith.com"
              className="relative z-10 inline-flex items-center gap-2 rounded-full text-sm px-8 py-4 transition-all duration-300 hover:scale-105"
              style={{
                border: '1px solid hsl(0 0% 12%)',
                backgroundColor: 'hsl(0 0% 4%)',
                color: 'hsl(0 0% 96%)',
              }}
            >
              hello@michaelsmith.com ↗
            </a>
          </div>
        </div>

        {/* Footer bar */}
        <div
          className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 flex flex-col sm:flex-row items-center justify-between gap-4 pt-8"
          style={{ borderTop: '1px solid hsl(0 0% 12%)' }}
        >
          {/* Social links */}
          <div className="flex items-center gap-6">
            {socials.map(s => (
              <a
                key={s.label}
                href={s.href}
                className="text-xs uppercase tracking-widest transition-colors duration-200"
                style={{ color: 'hsl(0 0% 53%)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(0 0% 96%)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(0 0% 53%)';
                }}
              >
                {s.label}
              </a>
            ))}
          </div>

          {/* Available badge */}
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full animate-pulse-dot"
              style={{ backgroundColor: '#22c55e' }}
            />
            <span className="text-xs" style={{ color: 'hsl(0 0% 53%)' }}>
              Available for projects
            </span>
          </div>
        </div>

        {/* Copyright */}
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 mt-6">
          <p className="text-xs text-center" style={{ color: 'hsl(0 0% 53% / 0.5)' }}>
            © 2026 Michael Smith. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
