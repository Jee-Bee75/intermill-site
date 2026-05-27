import { motion } from 'framer-motion';

const projects = [
  {
    id: 1,
    title: 'Automotive Motion',
    span: 7,
    aspect: 'aspect-[16/10]',
    image: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=900&q=80&fit=crop',
  },
  {
    id: 2,
    title: 'Urban Architecture',
    span: 5,
    aspect: 'aspect-[4/5]',
    image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=700&q=80&fit=crop',
  },
  {
    id: 3,
    title: 'Human Perspective',
    span: 5,
    aspect: 'aspect-[4/5]',
    image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=700&q=80&fit=crop',
  },
  {
    id: 4,
    title: 'Brand Identity',
    span: 7,
    aspect: 'aspect-[16/10]',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=900&q=80&fit=crop',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 1, ease: 'easeOut' } },
} as const;

export default function Works() {
  return (
    <section id="work" className="py-12 md:py-16" style={{ backgroundColor: 'hsl(0 0% 4%)' }}>
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
                Selected Work
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light mb-2" style={{ color: 'hsl(0 0% 96%)' }}>
              Featured{' '}
              <em
                className="font-normal"
                style={{ fontFamily: "'Instrument Serif', serif", color: 'hsl(0 0% 96%)' }}
              >
                projects
              </em>
            </h2>
            <p className="text-sm" style={{ color: 'hsl(0 0% 53%)' }}>
              A selection of projects I've worked on, from concept to launch.
            </p>
          </div>

          {/* View all — desktop only */}
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
                View all work <span>→</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
          {projects.map((p, i) => (
            <motion.div
              key={p.id}
              className={`md:col-span-${p.span} group relative overflow-hidden rounded-3xl cursor-pointer`}
              style={{
                backgroundColor: 'hsl(0 0% 8%)',
                border: '1px solid hsl(0 0% 12%)',
              }}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.1 }}
            >
              <div className={`relative w-full ${p.aspect} overflow-hidden`}>
                {/* Image */}
                <img
                  src={p.image}
                  alt={p.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />

                {/* Halftone overlay */}
                <div
                  className="absolute inset-0 opacity-20 mix-blend-multiply pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
                    backgroundSize: '4px 4px',
                  }}
                />

                {/* Hover overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 backdrop-blur-lg flex items-end p-6"
                  style={{ backgroundColor: 'hsl(0 0% 4% / 0.7)' }}
                >
                  {/* Pill label */}
                  <div className="relative">
                    <span
                      className="absolute rounded-full pointer-events-none"
                      style={{
                        inset: -2,
                        background: 'linear-gradient(90deg, #89AACC 0%, #4E85BF 100%)',
                        borderRadius: 9999,
                        zIndex: 0,
                      }}
                    />
                    <span
                      className="relative z-10 inline-flex items-center rounded-full px-4 py-2 text-sm"
                      style={{
                        backgroundColor: 'white',
                        color: 'hsl(0 0% 4%)',
                      }}
                    >
                      View —{' '}
                      <em
                        className="ml-1"
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                      >
                        {p.title}
                      </em>
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
