const navToggle = document.querySelector('.header__nav-toggle');

navToggle.addEventListener('click', () => {
  document.body.classList.toggle('nav-open');
});
