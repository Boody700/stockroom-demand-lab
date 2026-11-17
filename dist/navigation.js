// Focus content without replacing the application's page hash.
const skip = document.querySelector('.skip');
skip?.addEventListener('click', event => {
  const main = document.getElementById('main');
  if (!main) return;
  event.preventDefault();
  main.focus({preventScroll:true});
  main.scrollIntoView({block:'start',behavior:'instant'});
});
