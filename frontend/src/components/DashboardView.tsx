import React, { useEffect, useState } from 'react';
import { ArrowRight, FolderUp, GitCompareArrows, GitMerge, History } from 'lucide-react';
import duplicatesImage from '../images/recmatch-4-doublons.png';
import fusionImage from '../images/recmatch-5-fusion.png';
import historyImage from '../images/recmatch-6-historique.png';
import { ActiveTab } from '../types';

interface DashboardViewProps {
  setActiveTab: (tab: ActiveTab) => void;
}

const slides = [
  {
    eyebrow: 'Étape 1 · Détecter',
    title: 'Repérez les doublons',
    description: 'Identifiez rapidement les fiches similaires et examinez leur niveau de concordance.',
    icon: GitCompareArrows,
    image: duplicatesImage,
    imageAlt: 'Illustration de détection de fiches en doublon',
    label: 'Détection des doublons',
  },
  {
    eyebrow: 'Étape 2 · Fusionner',
    title: 'Rassemblez les informations utiles',
    description: 'Réunissez les données rapprochées pour obtenir une fiche plus complète.',
    icon: GitMerge,
    image: fusionImage,
    imageAlt: 'Illustration de fusion de plusieurs fiches en un profil',
    label: 'Fusion des fiches',
  },
  {
    eyebrow: 'Étape 3 · Historique',
    title: 'Retrouvez vos analyses',
    description: 'Consultez les résultats précédents et gardez une trace claire de vos rapprochements.',
    icon: History,
    image: historyImage,
    imageAlt: 'Illustration de résultats et historique des analyses',
    label: 'Suivi des analyses',
  },
];

export const DashboardView: React.FC<DashboardViewProps> = ({ setActiveTab }) => {
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 5500);
    return () => window.clearInterval(timer);
  }, [paused]);

  const slide = slides[activeSlide];
  const SlideIcon = slide.icon;

  return (
    <section
      id="dashboard-view"
      role="region"
      aria-roledescription="carrousel"
      aria-label="Présentation de RecMatch"
      className="mx-auto flex min-h-[70vh] w-full max-w-5xl items-center justify-center py-8 sm:py-12"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
    >
      <div className="relative flex min-h-[440px] w-full flex-col justify-between overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-[0_18px_55px_-35px_rgba(16,76,54,.35)] sm:min-h-[500px] sm:p-10 lg:p-14">
        <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full border border-[var(--primary)]/10" />
        <div className="pointer-events-none absolute -right-6 -top-6 h-56 w-56 rounded-full border border-[var(--border)]" />

        <div className="relative flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Comment ça marche</span>
          <span className="rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs font-medium text-[var(--text)]">
            {String(activeSlide + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
        </div>

        <div key={activeSlide} className="dashboard-slide relative my-6 grid items-center gap-4 md:my-7 md:grid-cols-[.82fr_1.18fr] md:gap-5">
          <div className="relative z-10 max-w-xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg)] shadow-lg shadow-black/10 backdrop-blur sm:h-14 sm:w-14">
              <SlideIcon className="h-6 w-6 text-[var(--primary)] sm:h-7 sm:w-7" aria-hidden="true" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">{slide.eyebrow}</p>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl lg:text-4xl">{slide.title}</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-[var(--muted)]">{slide.description}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2 text-xs font-medium text-[var(--muted)]">
              <SlideIcon className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
              {slide.label}
            </div>
          </div>

          <div className="relative flex min-h-[190px] items-center justify-center sm:min-h-[250px] md:min-h-[340px]">
            <div className="pointer-events-none absolute inset-[15%] rounded-full bg-[var(--primary-light)]/30 blur-3xl" />
            <img
              src={slide.image}
              alt={slide.imageAlt}
              className="relative z-10 max-h-[340px] w-full object-contain drop-shadow-2xl"
              decoding="async"
            />
          </div>
        </div>

        <div className="relative flex flex-col gap-5 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className="group inline-flex w-fit items-center gap-3 rounded-full bg-[var(--primary)] px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-[var(--primary)]/20 transition duration-200 hover:-translate-y-0.5 hover:bg-[var(--primary-dark)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
          >
            <FolderUp className="h-4 w-4" aria-hidden="true" />
            Importer un fichier
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>

          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <p className="text-xs text-[var(--muted)]">Un processus clair, de l’import au résultat.</p>
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Choisir une étape">
              {slides.map((item, index) => (
                <button
                  key={item.eyebrow}
                  type="button"
                  onClick={() => setActiveSlide(index)}
                  aria-label={item.eyebrow}
                  aria-pressed={activeSlide === index}
                  className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${activeSlide === index ? 'w-7 bg-[var(--primary)]' : 'w-2.5 bg-[var(--muted)]/30 hover:bg-[var(--muted)]/60'}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
