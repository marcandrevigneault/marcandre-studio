// Progressive scroll-reveal. Honors prefers-reduced-motion and degrades to
// fully-visible content when IntersectionObserver is unavailable.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const items = document.querySelectorAll('[data-reveal]');

if (reduce || !('IntersectionObserver' in window)) {
  items.forEach((el) => el.classList.add('is-in'));
} else {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // Optional per-item stagger via data-reveal="<index>".
          const delay = Number(entry.target.dataset.reveal) || 0;
          entry.target.style.transitionDelay = `${Math.min(delay * 60, 400)}ms`;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
}
