import { Filter, readFilter } from "./filter.js";
import { PassiveEffect } from "./passive-effect.js";
import { StaticValues } from "./static-values.js";

const flagScope = StaticValues.moduleName;

// Provide type safety
type ItemData = any;

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
    return !effect.data.disabled;
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

  public readActiveEffectItems(): {wrappedId: number, data: ItemData}[] {
    const effect = this.getActiveEffect();
    if (!effect) {
      return [];
    }
    const items = effect.getFlag(flagScope, 'items');
    if (!items) {
      return [];
    }

    items.filter(item => typeof item.data === 'object' && Number.isInteger(item.wrappedId)).sort((a, b) => a.data.name.localeCompare(b.data.name));
    return JSON.parse(JSON.stringify(items));
  }

  public readFilters(): Filter | null {
    const effect = this.getActiveEffect();
    if (!effect) {
      return null;
    }

    return readFilter(effect.getFlag(flagScope, 'filters')).normalizedFilters;
  }

  public async writeFilters(filterGroup: Filter.Group | null): Promise<any> {
    /* Validate */
    const validateResult = readFilter(filterGroup);
    if (validateResult.valid === false) {
      throw new Error(validateResult.errorMessage);
    }

    /* Execute */
    const activeEffect = this.getActiveEffect();
    return activeEffect.setFlag(flagScope, "filters", validateResult.normalizedFilters);
  }

  /**
   * Validate if an item can be added
   */
  public validateItem(item: ItemData): {valid: true} | {valid: false, errorMessage: string} {
    if (!item || !StaticValues.supportedItemTypes.includes(item.type)) {
      return {valid: false, errorMessage: 'Supported items: ' + StaticValues.supportedItemTypes.sort().join(', ')};
    }
    return {valid: true};
  }

  public async addItem(item: ItemData): Promise<any> {
    const validateResult = this.validateItem(item);
    if (validateResult.valid === false) {
      throw new Error(validateResult.errorMessage);
    }
    
    const items: {wrappedId?: number, data: ItemData}[] = this.readActiveEffectItems();
    items.push({data: item});
    return this.writeActiveEffectItems(items);
  }

  public async deleteItem(itemOrId: {wrappedId: number, data?: any} | number): Promise<any> {
    let id: number;
    if (typeof itemOrId === 'number') {
      id = itemOrId;
    } else {
      id = itemOrId.wrappedId;
    }

    return this.writeActiveEffectItems(this.readActiveEffectItems().filter(item => item.wrappedId !== id));
  }

  public async writeActiveEffectItems(items: {wrappedId?: number, data: ItemData}[]): Promise<any> {
    items = items.filter(item => StaticValues.supportedItemTypes.includes(item.data.type));
    for (let i = 0; i < items.length; i++) {
      items[i].data = JSON.parse(JSON.stringify(items[i].data));
      delete items[i].data._id;
    }
    const activeEffect = this.getActiveEffect();
    const nextInitialId = activeEffect.getFlag(flagScope, 'itemsNextId') || 0;
    let nextId = nextInitialId;

    for (const item of items) {
      if (!Number.isInteger(item.wrappedId)) {
        item.wrappedId = nextId++;
      }
    }
    
    const promises = [];
    if (nextInitialId !== nextId) {
      promises.push(activeEffect.setFlag(flagScope, "itemsNextId", nextId));
    }
    promises.push(activeEffect.setFlag(flagScope, "items", items));
    return Promise.all(promises);
  }

}