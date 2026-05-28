import { motion } from 'framer-motion';

const entries = [
  {
    id: 1,
    title: 'The Art of Minimal Design Systems',
    gradient: 'linear-gradient(135deg, #89AACC, #4E85BF)',
    readTime: '5 min read',
    date: 'Mar 12, 2026',
  },
  {
    id: 2,
    title: 'Building for Performance Without Compromise',
    gradient: 'linear-gradient(135deg, #2d2d2d, #4a4a4a)',
    readTime: '8 min read',
    date: 'Feb 28, 2026',
  },
  {
    id: 3,
    title: 'Motion Design: When Animation Serves Purpose',
    gradient: 'linear-gradient(135deg, #1a1a2e, #0f3460)',
    readTime: '6 min read',
    date: 'Jan 15, 2026',
  },
  {
    id: 4,
    title: 'Founder Lessons from 5 Years of Building Products',
    gradient: 'linear-gradient(135deg, #1a2e1a, #2a4a2a)',
    readTime: '10 min read',
    date: 'Dec 4, 2025',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 1, ease: 'easeOut' } },
} as const;

export default function Journal() {
  return (
    <section id="journal" className="py-16 md:py-24" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">

        {/* Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end md:justify-between mb-10 md:mb-14"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          variants={fadeUp}
        >
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-8 h-px" style={{ backgroundColor: 'hsl(0 0% 12%)' }} />
              <span className="text-xs uppercase tracking-[0.3em]" style={{ color: 'hsl(0 0% 53%)' }}>
                Journal
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light mb-2" style={{ color: 'hsl(0 0% 96%)' }}>
              Recent{' '}
              <em
                className="font-normal"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                thoughts
              </em>
            </h2>
            <p className="text-sm" style={{ color: 'hsl(0 0% 53%)' }}>
              Ideas, reflections, and things I've learned along the way.
            </p>
          </div>

          <div className="hidden md:block mt-4 md:mt-0">
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
              <button
                className="relative z-10 inline-flex items-center gap-2 rounded-full text-sm px-6 py-2.5 transition-all duration-300"
                style={{
                  border: '1px solid hsl(0 0% 12%)',
                  backgroundColor: 'hsl(0 0% 4%)',
                  color: 'hsl(0 0% 96%)',
                }}
              >
                View all <span>→</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Entry list */}
        <div className="flex flex-col gap-3">
          {entries.map((entry, i) => (
            <motion.div
              key={entry.id}
              className="group flex items-center gap-6 p-4 rounded-[40px] sm:rounded-full cursor-pointer transition-colors duration-300"
              style={{
                backgroundColor: 'hsl(0 0% 8% / 0.3)',
                border: '1px solid hsl(0 0% 12%)',
              }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.08 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'hsl(0 0% 8%)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.backgroundColor = 'hsl(0 0% 8% / 0.3)';
              }}
            >
              {/* Thumbnail */}
              <div
                className="flex-shrink-0 w-12 h-12 rounded-full"
                style={{ background: entry.gradient }}
              />

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(0 0% 96%)' }}>
                  {entry.title}
                </p>
              </div>

              {/* Meta */}
              <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                <span className="text-xs" style={{ color: 'hsl(0 0% 53%)' }}>
                  {entry.readTime}
                </span>
                <span className="text-xs" style={{ color: 'hsl(0 0% 53%)' }}>
                  {entry.date}
                </span>
                <span style={{ color: 'hsl(0 0% 53%)' }}>→</span>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
