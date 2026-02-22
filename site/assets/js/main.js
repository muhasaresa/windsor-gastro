const nav = document.querySelector('.site-nav');
const menuButton = document.querySelector('.nav-toggle');
const siteHeader = document.querySelector('.site-header');

if (nav && menuButton) {
  const menu = nav.querySelector('.nav-list');
  const navLinks = menu ? [...menu.querySelectorAll('a')] : [];

  const closeMenu = () => {
    nav.setAttribute('data-open', 'false');
    menuButton.setAttribute('aria-expanded', 'false');
  };

  menuButton.addEventListener('click', () => {
    const isOpen = nav.getAttribute('data-open') === 'true';
    nav.setAttribute('data-open', String(!isOpen));
    menuButton.setAttribute('aria-expanded', String(!isOpen));

    if (!isOpen) {
      menu?.querySelector('a')?.focus();
    }
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      menuButton.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target) && event.target !== menuButton) {
      closeMenu();
    }
  });

  const desktopQuery = window.matchMedia('(min-width: 901px)');
  const syncDesktopState = (query) => {
    if (query.matches) {
      closeMenu();
    }
  };

  if (desktopQuery.addEventListener) {
    desktopQuery.addEventListener('change', syncDesktopState);
  } else {
    desktopQuery.addListener(syncDesktopState);
  }
}

if (siteHeader) {
  const toggleShadow = () => {
    if (window.scrollY > 8) {
      siteHeader.classList.add('is-scrolled');
    } else {
      siteHeader.classList.remove('is-scrolled');
    }
  };

  toggleShadow();
  window.addEventListener('scroll', toggleShadow, { passive: true });
}

const revealItems = document.querySelectorAll('.reveal');

if (revealItems.length > 0) {
  if (!('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('is-visible'));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2,
        rootMargin: '0px 0px -8% 0px',
      }
    );

    revealItems.forEach((item) => observer.observe(item));
  }
}
