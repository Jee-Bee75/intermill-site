import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion, AnimatePresence } from 'framer-motion';

gsap.registerPlugin(ScrollTrigger);

const items = [
  { id: 1, col: 0, gradient: 'linear-gradient(135deg, #89AACC 0%, #4E85BF 100%)', rotation: -3 },
  { id: 2, col: 1, gradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', rotation: 2 },
  { id: 3, col: 0, gradient: 'linear-gradient(135deg, #2d1b4e 0%, #3d2a5e 100%)', rotation: 1 },
  { id: 4, col: 1, gradient: 'linear-gradient(135deg, #0a1a0a 0%, #2a4a2a 100%)', rotation: -2 },
  { id: 5, col: 0, gradient: 'linear-gradient(135deg, #1a0a0a 0%, #4a1a1a 100%)', rotation: 3 },
  { id: 6, col: 1, gradient: 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)', rotation: -1 },
];

export default function Explorations() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const col0Ref = useRef<HTMLDivElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const col0 = items.filter(i => i.col === 0);
  const col1 = items.filter(i => i.col === 1);

  useEffect(() => {
    const section = sectionRef.current;
    const content = contentRef.current;
    const c0 = col0Ref.current;
    const c1 = col1Ref.current;
    if (!section || !content || !c0 || !c1) return;

    // Pin center content
    const pinTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      pin: content,
      pinSpacing: false,
    });

    // Parallax for column 0 (moves up)
    gsap.fromTo(
      c0,
      { y: 0 },
      {
        y: -200,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
        },
      }
    );

    // Parallax for column 1 (moves down)
    gsap.fromTo(
      c1,
      { y: 0 },
      {
        y: 200,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1.5,
        },
      }
    );

    return () => {
      pinTrigger.kill();
      ScrollTrigger.getAll().forEach(t => t.kill());
    };
  }, []);

  return (
    <>
      <section
        id="explorations"
        ref={sectionRef}
        className="relative"
        style={{
          minHeight: '300vh',
          backgroundColor: 'hsl(0 0% 4%)',
        }}
      >
        {/* Pinned center text — z-10 */}
        <div
          ref={contentRef}
          className="relative z-10 flex items-center justify-center"
          style={{ height: '100vh' }}
        >
          <div className="text-center px-6 max-w-lg">
            <div className="flex items-center justify-center gap-3 mb-3">
              <span className="w-8 h-px" style={{ backgroundColor: 'hsl(0 0% 12%)' }} />
              <span className="text-xs uppercase tracking-[0.3em]" style={{ color: 'hsl(0 0% 53%)' }}>
                Explorations
              </span>
              <span className="w-8 h-px" style={{ backgroundColor: 'hsl(0 0% 12%)' }} />
            </div>
            <h2 className="text-3xl md:text-5xl font-light mb-4" style={{ color: 'hsl(0 0% 96%)' }}>
              Visual{' '}
              <em
                className="font-normal"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                playground
              </em>
            </h2>
            <p className="text-sm mb-8" style={{ color: 'hsl(0 0% 53%)' }}>
              A collection of visual experiments, UI explorations, and creative work.
            </p>
            <div className="relative group inline-block">
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
                href="https://dribbble.com"
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 inline-flex items-center gap-2 rounded-full text-sm px-6 py-2.5"
                style={{
                  border: '1px solid hsl(0 0% 12%)',
                  backgroundColor: 'hsl(0 0% 4%)',
                  color: 'hsl(0 0% 96%)',
                }}
              >
                View on Dribbble ↗
              </a>
            </div>
          </div>
        </div>

        {/* Parallax columns — z-20, absolute */}
        <div
          className="absolute inset-0 z-20 flex items-start justify-center pointer-events-none"
          style={{ top: '10vh' }}
        >
          <div className="w-full max-w-[1400px] px-6 grid grid-cols-2 gap-12 md:gap-40 pointer-events-auto">
            {/* Column 0 */}
            <div ref={col0Ref} className="flex flex-col gap-8 pt-12">
              {col0.map(item => (
                <div
                  key={item.id}
                  className="relative aspect-square max-w-[320px] rounded-2xl overflow-hidden cursor-pointer mx-auto"
                  style={{
                    transform: `rotate(${item.rotation}deg)`,
                    border: '1px solid hsl(0 0% 12%)',
                  }}
                  onClick={() => setLightbox(item.gradient)}
                >
                  <div
                    className="w-full h-full transition-transform duration-500 hover:scale-105"
                    style={{ background: item.gradient }}
                  />
                </div>
              ))}
            </div>

            {/* Column 1 */}
            <div ref={col1Ref} className="flex flex-col gap-8 mt-24">
              {col1.map(item => (
                <div
                  key={item.id}
                  className="relative aspect-square max-w-[320px] rounded-2xl overflow-hidden cursor-pointer mx-auto"
                  style={{
                    transform: `rotate(${item.rotation}deg)`,
                    border: '1px solid hsl(0 0% 12%)',
                  }}
                  onClick={() => setLightbox(item.gradient)}
                >
                  <div
                    className="w-full h-full transition-transform duration-500 hover:scale-105"
                    style={{ background: item.gradient }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="fixed inset-0 z-[9000] flex items-center justify-center p-8"
            style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <motion.div
              className="w-80 h-80 rounded-2xl"
              style={{ background: lightbox ?? undefined }}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
