import { extendActiveEffectService } from "./extend-active-effects.js";
import { Filter } from "./filter.js";
import { ActiveEffectData, PassiveEffect } from "./passive-effect.js";
import { StaticValues } from "./static-values.js";

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
      const activeAndPassiveEffects: Collection<ActiveEffect> = new Collection([]);
      this.prepareDerivedData();
      const rollData = this.getRollData();
      originalEffects.forEach(effect => {
        const matches = service.matchesFilter({effect: effect, parsedParentData: rollData})
        if (!effect.data.flags[StaticValues.moduleName]) {
          effect.data.flags[StaticValues.moduleName] = {};
        }
        effect.data.flags[StaticValues.moduleName].filterMatches = matches;
        if (matches) {
          activeAndPassiveEffects.set(effect.data._id, effect);
        }
      });
      PassiveEffect.getPassiveEffects(this).forEach(effect => {
        if (service.matchesFilter({effect: effect, parsedParentData: rollData})) {
          activeAndPassiveEffects.set(effect.data._id, effect);
        }
      });
      this.effects = activeAndPassiveEffects;
      service.originalActorApplyActiveEffects.call(this);
      this.effects = originalEffects;

      if ((this.constructor as any)?.config?.collection) {
        extendActiveEffectService.calcApplyActorItems(this);
      }
    }
  }

  private matchesFilter({
    effect,
    parsedParentData
  }: {
    effect: ActiveEffect;
    parsedParentData?: any;
  }): boolean {
    const filter = new Filter(effect.data?.flags?.[StaticValues.moduleName]?.filter);

    const data: any = {};
    if (parsedParentData) {
      data.data = parsedParentData;
    } else {
      data.data = (effect.parent instanceof Actor) ? effect.parent.getRollData() : effect.parent.data
    }

    const regx = (effect.data as ActiveEffectData)?.origin?.match(/^Actor\.([^\.]+)\.OwnedItem\.(.+)$/);
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