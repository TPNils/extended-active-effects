import { CompendiumUtils } from "./compendium-utils.js";
import { Filter } from "./filter.js";
import { PassiveEffect } from "./passive-effect.js";
import { StaticValues } from "./static-values.js";

function uuid() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

const flagScope = StaticValues.moduleName;

// Provide type safety
export interface ItemReference {
  id: string;
  compendiumId: string;
  entityId: string;
};
export type NewItemReference = Omit<ItemReference, 'id'>;
interface LoadedItemReference extends ItemReference {
  itemData: Item.Data<any>;
}

type EffectParent = {
  actor?: Actor & {effects?: Collection<ActiveEffect>};
  item?: Item & {effects?: Collection<ActiveEffect>};
  actorId?: string;
  itemId?: string;
};

type Effect = {
  activeEffect?: ActiveEffect
  activeEffectId?: string;
  passiveEffect?: ActiveEffect
  passiveEffectId?: string;
};

export class WrappedActiveEffect {

  constructor(
    private parent: EffectParent,
    private effect: Effect
  ) {
    if (!parent) {
      throw new Error('parent is required');
    }
    if (Object.keys(parent).length !== 1) {
      throw new Error('parent must have 1 key');
    }
    if (!effect) {
      throw new Error('effect is required');
    }
    if (Object.keys(effect).length !== 1) {
      throw new Error('effect must have 1 key');
    }
  }

  private getActiveEffect(): ActiveEffect {
    if (this.effect.activeEffect) {
      return this.effect.activeEffect;
    }
    if (this.effect.passiveEffect) {
      return this.effect.passiveEffect;
    }
    let parent: (Actor | Item) & {effects?: Collection<ActiveEffect>} = this.parent.actor;
    if (!parent) {
      parent = this.parent.item;
    }
    if (!parent) {
      parent = game.actors.get(this.parent.actorId);
    }
    if (!parent) {
      parent = game.items.get(this.parent.itemId);
    }
    if (!parent) {
      throw new Error('Could not find parent ' + JSON.stringify(this.parent));
    }
    if (this.effect.activeEffectId) {
      return parent.effects.get(this.effect.activeEffectId);
    } else if (this.effect.passiveEffectId) {
      return PassiveEffect.getPassiveEffects(parent).get(this.effect.passiveEffectId);
    } else {
      return null;
    }
  }

  public isEnabled(): boolean {
    const effect = this.getActiveEffect();
    if (!effect) {
      return false;
    }
    return !effect.data.disabled && !(effect.data.flags?.[StaticValues.moduleName]?.filterMatches === false);
  }

  /**
   * TODO better name, since it (correctly) only returns owned items
   */
  public getParent(): Actor | Item {
    const effect = this.getActiveEffect();
    if (!effect || !effect.data || !effect.data.origin) {
      return null;
    }
    const regResponse = effect.data.origin.match(/^Actor\.([^\.]+)\.OwnedItem\.(.+)$/);
    if (regResponse === null) {
      return null;
    }

    let actor: Actor;
    if (this.parent.actor && this.parent.actor.data._id === regResponse[1]) {
      actor = this.parent.actor;
    } else {
      actor = game.actors.get(regResponse[1]);
    }
    
    return actor.items.get(regResponse[2]);
  }
  
  private readItemReferences(): ItemReference[] {
    const effect = this.getActiveEffect();
    if (!effect) {
      return [];
    }
    const items: ItemReference[] = effect.getFlag(flagScope, 'items');
    if (!items) {
      return [];
    }
    return items.filter(item => item?.compendiumId && item?.entityId);
  }

  public async readActiveEffectItems(): Promise<LoadedItemReference[]> {
    return Promise.all(this.readItemReferences().map(item => {
      return CompendiumUtils.request(item.compendiumId, item.entityId).then(response => {
        return {
          ...item,
          itemData: response.data as Item.Data
        }
      });
    }));
  }

  public readFilters(): Filter | null {
    const effect = this.getActiveEffect();
    if (!effect) {
      return null;
    }

    return new Filter(effect.getFlag(flagScope, 'filters'));
  }

  public async writeFilters(filterGroup: Filter.Group | null): Promise<any> {
    /* Validate */
    const validateResult = new Filter(filterGroup);

    /* Execute */
    const activeEffect = this.getActiveEffect();
    return activeEffect.setFlag(flagScope, "filters", validateResult.data);
  }

  public async addItem(item: NewItemReference): Promise<any> {
    const items = this.readItemReferences();
    items.push({
      ...item,
      id: uuid()
    });
    return this.writeActiveEffectItems(items);
  }

  public async deleteItems(id: string | string[]): Promise<any> {
    if (!Array.isArray(id)) {
      id = [id];
    }
    return this.writeActiveEffectItems(this.readItemReferences().filter(item => !id.includes(item.id)));
  }

  public async writeActiveEffectItems(items: ItemReference[]): Promise<any> {
    return this.getActiveEffect().setFlag(flagScope, "items", items);
  }

}