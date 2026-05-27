import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onComplete: () => void;
}

const words = ['Design', 'Create', 'Inspire'];

export default function LoadingScreen({ onComplete }: Props) {
  const [count, setCount] = useState(0);
  const [wordIndex, setWordIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const startTime = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const duration = 2700;

  useEffect(() => {
    const animate = (ts: number) => {
      if (!startTime.current) startTime.current = ts;
      const elapsed = ts - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.floor(progress * 100);
      setCount(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setTimeout(() => {
          setVisible(false);
          setTimeout(onComplete, 600);
        }, 400);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onComplete]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex(i => (i + 1) % words.length);
    }, 900);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ backgroundColor: 'hsl(0 0% 4%)' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
        >
          {/* Top-left label */}
          <motion.div
            className="absolute top-8 left-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          >
            <span
              className="text-xs uppercase tracking-[0.3em]"
              style={{ color: 'hsl(0 0% 53%)' }}
            >
              Portfolio
            </span>
          </motion.div>

          {/* Center word cycling */}
          <div className="flex-1 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={wordIndex}
                className="text-4xl md:text-6xl lg:text-7xl italic"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  color: 'hsl(0 0% 96% / 0.8)',
                }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.35, ease: 'easeInOut' }}
              >
                {words[wordIndex]}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Bottom row */}
          <div className="p-8 flex flex-col gap-4">
            {/* Counter bottom-right */}
            <div className="flex justify-end">
              <span
                className="text-6xl md:text-8xl lg:text-9xl tabular-nums"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  color: 'hsl(0 0% 96%)',
                }}
              >
                {String(count).padStart(3, '0')}
              </span>
            </div>

            {/* Progress bar */}
            <div
              className="h-[3px] w-full rounded-full overflow-hidden"
              style={{ backgroundColor: 'hsl(0 0% 12% / 0.5)' }}
            >
              <div
                className="h-full rounded-full origin-left"
                style={{
                  background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
                  transform: `scaleX(${count / 100})`,
                  transition: 'transform 0.05s linear',
                  boxShadow: '0 0 8px rgba(137, 170, 204, 0.35)',
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
