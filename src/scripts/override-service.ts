import { Filter } from "./filter.js";
import { ActiveEffectData, PassiveEffect } from "./passive-effect.js";

class OverrideService {
  private originalActorApplyActiveEffects: () => void;
  
  public injectIntoActor(): void {
    if (this.originalActorApplyActiveEffects) {
      throw new Error('Already registered');
    }
    this.originalActorApplyActiveEffects = CONFIG.Actor.entityClass.prototype.applyActiveEffects;
    const service = this;

    CONFIG.Actor.entityClass.prototype.applyActiveEffects = function (this: Actor<any>) {
      const originalEffects = this.effects;
      const originalFilteredEffects: Collection<ActiveEffect> = new Collection([]);
      const activeAndPassiveEffects: Collection<ActiveEffect> = new Collection([]);
      originalEffects.forEach(effect => {
        if (service.matchesFilter(effect)) {
          originalFilteredEffects.set(effect.data._id, effect);
          activeAndPassiveEffects.set(effect.data._id, effect);
        }
      });
      PassiveEffect.getPassiveEffects(this).forEach(effect => {
        if (service.matchesFilter(effect)) {
          activeAndPassiveEffects.set(effect.data._id, effect);
        }
      });
      this.effects = activeAndPassiveEffects;
      service.originalActorApplyActiveEffects.call(this);
      this.effects = originalFilteredEffects;
    }
  }

  private matchesFilter(effect: ActiveEffect): boolean {
    const filter = new Filter(effect.data);

    const data: any = {
      data: effect.parent.data
    };

    const regx = (effect.data as ActiveEffectData)?.origin.match(/^Actor\.([^\.]+)\.OwnedItem\.(.+)$/);
    if (regx) {
      const itemData = game.actors?.get(regx[1])?.items.get(regx[2])?.data;
      if (itemData) {
        data.item = itemData;
      }
    }

    return filter.matches(data);
  }

}

const overrideService = new OverrideService();

export function init(): void {
  Hooks.on('init', () => {
    overrideService.injectIntoActor();
  })
}