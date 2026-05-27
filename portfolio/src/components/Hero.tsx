import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import HeroVideo from './HeroVideo';

const roles = ['Creative', 'Fullstack', 'Founder', 'Scholar'];

export default function Hero() {
  const [roleIndex, setRoleIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setRoleIndex(i => (i + 1) % roles.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.fromTo(
        '.name-reveal',
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.2, delay: 0.1 }
      ).fromTo(
        '.blur-in',
        { opacity: 0, filter: 'blur(10px)', y: 20 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 1, stagger: 0.1, delay: 0.3 },
        '<0.3'
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="home"
      ref={containerRef}
      className="relative w-full min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background video */}
      <div className="absolute inset-0">
        <HeroVideo />
        {/* Overlays */}
        <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }} />
        <div
          className="absolute bottom-0 left-0 right-0 h-48"
          style={{
            background: 'linear-gradient(to top, hsl(0 0% 4%), transparent)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        {/* Eyebrow */}
        <p
          className="blur-in text-xs uppercase tracking-[0.3em] mb-8"
          style={{ color: 'hsl(0 0% 53%)', opacity: 0 }}
        >
          COLLECTION '26
        </p>

        {/* Name */}
        <h1
          className="name-reveal text-6xl md:text-8xl lg:text-9xl italic leading-[0.9] tracking-tight mb-6"
          style={{
            fontFamily: "'Instrument Serif', serif",
            color: 'hsl(0 0% 96%)',
            opacity: 0,
          }}
        >
          Michael Smith
        </h1>

        {/* Role line */}
        <p
          className="blur-in text-base md:text-lg mb-4"
          style={{ color: 'hsl(0 0% 53%)', opacity: 0 }}
        >
          A{' '}
          <span
            key={roleIndex}
            className="animate-role-fade-in inline-block italic"
            style={{
              fontFamily: "'Instrument Serif', serif",
              color: 'hsl(0 0% 96%)',
            }}
          >
            {roles[roleIndex]}
          </span>{' '}
          lives in Chicago.
        </p>

        {/* Description */}
        <p
          className="blur-in text-sm md:text-base max-w-md mb-12"
          style={{ color: 'hsl(0 0% 53%)', opacity: 0 }}
        >
          Designing seamless digital interactions by focusing on the unique nuances which bring systems to life.
        </p>

        {/* CTA buttons */}
        <div className="blur-in inline-flex gap-4" style={{ opacity: 0 }}>
          {/* See Works */}
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
              href="#work"
              onClick={e => {
                e.preventDefault();
                document.getElementById('work')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="relative z-10 inline-flex rounded-full text-sm px-7 py-3.5 font-medium transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: 'hsl(0 0% 96%)',
                color: 'hsl(0 0% 4%)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'hsl(0 0% 4%)';
                (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(0 0% 96%)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'hsl(0 0% 96%)';
                (e.currentTarget as HTMLAnchorElement).style.color = 'hsl(0 0% 4%)';
              }}
            >
              See Works
            </a>
          </div>

          {/* Reach out */}
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
              className="relative z-10 inline-flex rounded-full text-sm px-7 py-3.5 font-medium transition-all duration-300 hover:scale-105"
              style={{
                border: '2px solid hsl(0 0% 12%)',
                backgroundColor: 'hsl(0 0% 4%)',
                color: 'hsl(0 0% 96%)',
              }}
            >
              Reach out...
            </a>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
        <span
          className="text-xs uppercase tracking-[0.2em]"
          style={{ color: 'hsl(0 0% 53%)' }}
        >
          SCROLL
        </span>
        <div
          className="relative w-px h-10 overflow-hidden"
          style={{ backgroundColor: 'hsl(0 0% 12%)' }}
        >
          <div
            className="absolute w-full h-1/2 animate-scroll-down"
            style={{ background: 'linear-gradient(to bottom, transparent, hsl(0 0% 96%))' }}
          />
        </div>
      </div>
    </section>
  );
}
