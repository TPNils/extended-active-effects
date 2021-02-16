import { ExtendActiveEffectService } from './extend-active-effects.js';
import { init as initPassiveEffects } from './passive-effect.js';
import { init as initOverrideService } from './override-service.js';

const extendActiveEffectService = new ExtendActiveEffectService();
extendActiveEffectService.register();
initOverrideService();
initPassiveEffects();