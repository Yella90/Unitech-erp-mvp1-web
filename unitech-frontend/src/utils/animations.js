export function getAnimationCascadeClass(index = 0) {
  const delay = Math.min(Number(index) || 0, 12) * 75;
  return `animate-fade-in [animation-delay:${delay}ms]`;
}

export function triggerShake(element) {
  if (!element) return;

  if (typeof element.animate === 'function') {
    element.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(-3px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 320, easing: 'ease-in-out' }
    );
    return;
  }

  element.classList.remove('shake-animation');
  void element.offsetWidth;
  element.classList.add('shake-animation');
  window.setTimeout(() => element.classList.remove('shake-animation'), 340);
}
