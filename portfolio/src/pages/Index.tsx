import { useState, useEffect } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import Works from '../components/Works';
import Journal from '../components/Journal';
import Explorations from '../components/Explorations';
import Stats from '../components/Stats';
import Footer from '../components/Footer';

export default function Index() {
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const sections = ['home', 'work', 'journal', 'explorations', 'stats', 'contact'];

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-40% 0px -40% 0px' }
    );

    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [isLoading]);

  return (
    <>
      {isLoading && <LoadingScreen onComplete={() => setIsLoading(false)} />}

      {!isLoading && (
        <>
          <Navbar activeSection={activeSection} />
          <main>
            <Hero />
            <Works />
            <Journal />
            <Explorations />
            <Stats />
            <Footer />
          </main>
        </>
      )}
    </>
  );
}
