import { ExtendActiveEffectService } from './extend-active-effects.js';
import { registerPassiveEffects } from './passive-effect.js';

const extendActiveEffectService = new ExtendActiveEffectService();
extendActiveEffectService.register();

Hooks.on('init', () => {
  registerPassiveEffects();
})