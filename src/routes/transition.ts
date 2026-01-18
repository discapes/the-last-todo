import { crossfade } from 'svelte/transition';

// Custom easing: starts with initial velocity, then accelerates
// Blend of linear (initial velocity) and quadratic (acceleration)
const accelerateWithInitialVelocity = (t: number) => 0.3 * t + 0.7 * t * t * t;

export const [send, receive] = crossfade({
  duration: (d) => Math.sqrt(d * 600),
  easing: accelerateWithInitialVelocity,

  fallback(node) {
    const style = getComputedStyle(node);
    const transform = style.transform === 'none' ? '' : style.transform;

    return {
      duration: 400,
      easing: accelerateWithInitialVelocity,
      css: (t) => `
				transform: ${transform} scale(${t});
				opacity: ${t}
			`
    };
  }
});
