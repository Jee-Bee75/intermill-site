import { motion } from 'framer-motion';

const stats = [
  { value: '20+', label: 'Years Experience' },
  { value: '95+', label: 'Projects Done' },
  { value: '200%', label: 'Satisfied Clients' },
];

export default function Stats() {
  return (
    <section id="stats" className="py-16 md:py-24" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <div
          className="rounded-3xl p-10 md:p-16 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6"
          style={{
            backgroundColor: 'hsl(0 0% 8%)',
            border: '1px solid hsl(0 0% 12%)',
          }}
        >
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              className="flex flex-col items-center text-center"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: i * 0.15 }}
            >
              {/* Value */}
              <span
                className="text-5xl md:text-6xl lg:text-7xl font-light tracking-tight mb-2"
                style={{
                  fontFamily: "'Instrument Serif', serif",
                  background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {stat.value}
              </span>
              {/* Label */}
              <span className="text-sm uppercase tracking-[0.2em]" style={{ color: 'hsl(0 0% 53%)' }}>
                {stat.label}
              </span>

              {/* Divider (not on last) */}
              {i < stats.length - 1 && (
                <div
                  className="hidden md:block absolute"
                  style={{ /* handled by grid gap */ }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
