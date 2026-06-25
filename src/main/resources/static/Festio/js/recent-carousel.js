document.addEventListener('DOMContentLoaded', () => {
  const recentCarousel = document.querySelector('.recent-carousel');
  if (recentCarousel) {
    const prevBtn = recentCarousel.querySelector('.recent-prev');
    const nextBtn = recentCarousel.querySelector('.recent-next');
    const track = recentCarousel.querySelector('.recent-carousel-track');
    let currentIndex = 0;

    const showItem = (index, totalItems) => {
      if (track) {
        track.style.transform = `translateX(-${index * 100}%)`;
      }
    };

    if (prevBtn && nextBtn) {
      prevBtn.addEventListener('click', () => {
        const items = recentCarousel.querySelectorAll('.recent-item');
        if (items.length === 0) return;
        currentIndex = (currentIndex - 1 + items.length) % items.length;
        showItem(currentIndex, items.length);
      });
      nextBtn.addEventListener('click', () => {
        const items = recentCarousel.querySelectorAll('.recent-item');
        if (items.length === 0) return;
        currentIndex = (currentIndex + 1) % items.length;
        showItem(currentIndex, items.length);
      });
    }
  }
});
