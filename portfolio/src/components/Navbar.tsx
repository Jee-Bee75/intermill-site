import { useState, useEffect } from 'react';

const links = ['Home', 'Work', 'Resume'];

interface Props {
  activeSection: string;
}

export default function Navbar({ activeSection }: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id.toLowerCase());
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-6 px-4">
      <div
        className="inline-flex items-center rounded-full backdrop-blur-md border px-2 py-2 transition-shadow duration-300"
        style={{
          borderColor: 'rgba(255,255,255,0.1)',
          backgroundColor: 'hsl(0 0% 8%)',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="relative flex-shrink-0 group"
          style={{ width: 36, height: 36 }}
        >
          {/* Gradient ring */}
          <span
            className="absolute inset-0 rounded-full transition-all duration-300"
            style={{
              background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
              padding: 1.5,
            }}
          />
          {/* Inner */}
          <span
            className="absolute inset-[2px] rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'hsl(0 0% 4%)' }}
          >
            <span
              className="italic text-[13px] select-none"
              style={{
                fontFamily: "'Instrument Serif', serif",
                color: 'hsl(0 0% 96%)',
              }}
            >
              JA
            </span>
          </span>
        </button>

        {/* Divider */}
        <span
          className="hidden sm:block w-px h-5 mx-1 flex-shrink-0"
          style={{ backgroundColor: 'hsl(0 0% 12%)' }}
        />

        {/* Nav links */}
        {links.map(link => {
          const isActive = activeSection === link.toLowerCase();
          return (
            <button
              key={link}
              onClick={() => scrollTo(link)}
              className="text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-all duration-200"
              style={{
                color: isActive ? 'hsl(0 0% 96%)' : 'hsl(0 0% 53%)',
                backgroundColor: isActive ? 'hsl(0 0% 12% / 0.5)' : 'transparent',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 0% 96%)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'hsl(0 0% 12% / 0.5)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.color = 'hsl(0 0% 53%)';
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              {link}
            </button>
          );
        })}

        {/* Divider */}
        <span
          className="hidden sm:block w-px h-5 mx-1 flex-shrink-0"
          style={{ backgroundColor: 'hsl(0 0% 12%)' }}
        />

        {/* Say hi button */}
        <div className="relative group">
          {/* Gradient border on hover */}
          <span
            className="absolute rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
            style={{
              inset: -2,
              background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
              zIndex: 0,
              borderRadius: 9999,
            }}
          />
          <a
            href="mailto:hello@michaelsmith.com"
            className="relative z-10 flex items-center gap-1 text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors duration-200"
            style={{
              backgroundColor: 'hsl(0 0% 8%)',
              color: 'hsl(0 0% 96%)',
            }}
          >
            Say hi <span className="ml-0.5">↗</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
