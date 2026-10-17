// Motion is progressive enhancement: content and controls work without animation.
const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
const running = new Set();
const latestAnimation = new WeakMap();
const disclosureJobs = new WeakMap();
const dialogJobs = new WeakMap();
const toastJobs = new WeakMap();
const successTimers = new WeakMap();
const flights = new Set();
let revealObserver;
const ease = 'cubic-bezier(.22, 1, .36, 1)';

function play(element, frames, options = {}) {
  if (preference.matches || !element?.animate || !element.isConnected) return null;
  latestAnimation.get(element)?.cancel();
  const animation = element.animate(frames, { duration: 240, easing: ease, ...options });
  latestAnimation.set(element, animation);
  running.add(animation);
  const cleanup = () => {
    running.delete(animation);
    if (latestAnimation.get(element) === animation) latestAnimation.delete(element);
  };
  animation.finished.then(cleanup, cleanup);
  return animation;
}
function after(animation, callback) {
  return animation ? animation.finished.then(callback, callback) : Promise.resolve(callback());
}

function enhancePage(root, routeChanged = false) {
  revealObserver?.disconnect();
  for (const animation of running) if (!animation.effect?.target?.isConnected) animation.cancel();
  if (preference.matches) return;
  const main = root.querySelector('main');
  if (!main) return;
  if (routeChanged) play(main, [{ opacity: .65, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 220 });
  if (!('IntersectionObserver' in window)) return;
  // Offscreen content stays visible in CSS; nothing is hidden pending an observer.
  revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      revealObserver?.unobserve(entry.target);
      if (preference.matches || !entry.target.isConnected) continue;
      const siblings = [...entry.target.parentElement.children];
      const delay = Math.min(siblings.indexOf(entry.target) % 4, 3) * 35;
      play(entry.target, [{ opacity: .2, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 440, delay });
    }
  }, { threshold: .08 });
  main.querySelectorAll('.section-title, .category-card, .product, .story-image, .story-copy, .journal-card, .service-item').forEach(element => revealObserver.observe(element));
}

function disclosure(toggle, panel, open, { restoreFocus = false } = {}) {
  if (!toggle || !panel) return;
  if (!open && toggle.getAttribute('aria-expanded') !== 'true') {
    if (restoreFocus) toggle.focus();
    return;
  }
  const previous = disclosureJobs.get(panel);
  const job = {};
  disclosureJobs.set(panel, job);
  previous?.animation?.cancel();
  toggle.setAttribute('aria-expanded', String(open));
  if (restoreFocus) toggle.focus();
  if (open) {
    panel.hidden = false;
    panel.inert = false;
    job.animation = play(panel, [{ opacity: 0, transform: 'translateY(-7px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
  } else {
    panel.inert = true;
    job.animation = play(panel, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }], { duration: 120 });
    after(job.animation, () => { if (disclosureJobs.get(panel) === job) panel.hidden = true; });
  }
}

function installDialog(dialog) {
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeDialog(dialog);
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDialog(dialog);
  });
}
function openDialog(dialog) {
  const previous = dialogJobs.get(dialog), job = {};
  dialogJobs.set(dialog, job);
  previous?.animation?.cancel();
  dialog.inert = false;
  dialog.classList.remove('is-closing');
  if (!dialog.open) dialog.showModal();
  job.animation = play(dialog, [{ opacity: .3, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 240 });
}
function closeDialog(dialog, { immediate = false } = {}) {
  if (!dialog.open) return Promise.resolve();
  const previous = dialogJobs.get(dialog);
  if (previous?.closing && !immediate) return previous.finished;
  const job = { closing: true };
  dialogJobs.set(dialog, job);
  previous?.animation?.cancel();
  dialog.inert = true;
  dialog.classList.add('is-closing');
  job.animation = immediate ? null : play(dialog, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(8px) scale(.99)' }], { duration: 140 });
  job.finished = after(job.animation, () => {
    if (dialogJobs.get(dialog) !== job) return;
    dialog.close();
    dialog.inert = false;
    dialog.classList.remove('is-closing');
    dialogJobs.delete(dialog);
  });
  return job.finished;
}

function showToast(element, message, lifetime = 4000) {
  const previous = toastJobs.get(element), job = {};
  toastJobs.set(element, job);
  clearTimeout(previous?.timer);
  previous?.animation?.cancel();
  element.textContent = message;
  element.setAttribute('aria-atomic', 'true');
  element.style.display = 'block';
  job.animation = play(element, [{ opacity: 0, transform: 'translate(-50%, 10px)' }, { opacity: 1, transform: 'translate(-50%, 0)' }], { duration: 200 });
  job.timer = setTimeout(() => {
    if (toastJobs.get(element) !== job) return;
    job.animation = play(element, [{ opacity: 1, transform: 'translate(-50%, 0)' }, { opacity: 0, transform: 'translate(-50%, 8px)' }], { duration: 140 });
    after(job.animation, () => { if (toastJobs.get(element) === job) { element.style.display = 'none'; toastJobs.delete(element); } });
  }, lifetime);
}

function addedToCart(button) {
  if (preference.matches) return;
  if (button) {
    clearTimeout(successTimers.get(button));
    button.classList.add('is-success');
    successTimers.set(button, setTimeout(() => button.classList.remove('is-success'), 900));
  }
  play(document.querySelector('.cart-count'), [{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: .4 }, { transform: 'scale(1)' }], { duration: 380 });
  play(document.querySelector('.cart-link > .icon'), [{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)', offset: .3 }, { transform: 'rotate(9deg)', offset: .65 }, { transform: 'rotate(0)' }], { duration: 380 });
  const image = button?.closest('.product')?.querySelector('.product-image img') || (button?.id === 'detail-add' ? document.querySelector('#gallery-main-image') : null);
  const target = document.querySelector('.cart-link');
  if (!image?.complete || !image.naturalWidth || !target) return;
  const from = image.getBoundingClientRect(), to = target.getBoundingClientRect();
  const inViewport = rect => rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  if (!inViewport(from) || !inViewport(to)) return;
  if (flights.size >= 2) { const first = flights.values().next().value; first.animation?.cancel(); first.image.remove(); flights.delete(first); }
  const thumbnail = new Image();
  thumbnail.src = image.currentSrc || image.src;
  thumbnail.alt = '';
  thumbnail.setAttribute('aria-hidden', 'true');
  thumbnail.className = 'cart-flight';
  const startX = from.left + from.width / 2 - 27, startY = from.top + from.height / 2 - 27;
  Object.assign(thumbnail.style, { position: 'fixed', left: `${startX}px`, top: `${startY}px`, width: '54px', height: '54px', objectFit: 'cover', pointerEvents: 'none', zIndex: '100', borderRadius: '8px', boxShadow: '0 8px 24px #00476626' });
  document.body.append(thumbnail);
  const flight = { image: thumbnail };
  flights.add(flight);
  flight.animation = play(thumbnail, [{ opacity: .95, transform: 'translate(0,0) scale(1)' }, { opacity: 0, transform: `translate(${to.left + to.width / 2 - startX - 27}px,${to.top + to.height / 2 - startY - 27}px) scale(.2)` }], { duration: 480, easing: 'cubic-bezier(.4,0,.4,1)' });
  after(flight.animation, () => { thumbnail.remove(); flights.delete(flight); });
}
function imageChanged(image) {
  const reveal = () => play(image, [{ opacity: .25 }, { opacity: 1 }], { duration: 220 });
  if (image.complete) reveal(); else image.addEventListener('load', reveal, { once: true });
}
function quantityChanged(input) { play(input, [{ opacity: .4, transform: 'translateY(-2px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 160 }); }
function formError(form) { play(form.querySelector('.error'), [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' }], { duration: 220 }); }

preference.addEventListener('change', () => {
  if (!preference.matches) return;
  revealObserver?.disconnect();
  for (const animation of [...running]) animation.cancel();
  for (const flight of flights) flight.image.remove();
  flights.clear();
  document.querySelectorAll('.is-success').forEach(element => element.classList.remove('is-success'));
});
export const motion = { enhancePage, disclosure, installDialog, openDialog, closeDialog, showToast, addedToCart, imageChanged, quantityChanged, formError };
