import { ExtendActiveEffectService } from './extend-active-effects.js';
import { PassiveEffect, registerPassiveEffects } from './passive-effect.js';
import { StaticValues } from './static-values.js';

const extendActiveEffectService = new ExtendActiveEffectService();
extendActiveEffectService.register();

Hooks.on('init', () => {
  registerPassiveEffects();

  game[StaticValues.moduleName] = {
    PassiveEffect: PassiveEffect,
  }
})