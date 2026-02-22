const nav = document.querySelector('.site-nav');
const menuButton = document.querySelector('.nav-toggle');

if (nav && menuButton) {
  const menu = nav.querySelector('.nav-list');

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

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      menuButton.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target)) {
      closeMenu();
    }
  });
}
