import { ExtendActiveEffectService } from './extend-active-effects.js';
import { init as initPassiveEffects } from './passive-effect.js';

const extendActiveEffectService = new ExtendActiveEffectService();
extendActiveEffectService.register();
initPassiveEffects();