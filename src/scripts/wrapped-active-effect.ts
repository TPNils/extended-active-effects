import { StaticValues } from "./static-values.js";

// Might be relevant for 'natural' equipment and weapons

const filterGroupTypes = ['AND', 'OR'];
const filterComparisonTypes = ['=', '!=',, '>', '>=', '<', '<='];
const filterValueTypes = ['null', 'string', 'number', 'boolean'];

const flagScope = StaticValues.moduleName;

// Provide type safety
type Parent = (Actor | Item) & {effects?: Map<string, ActiveEffect>};
type ItemData = any;

interface FilterValue {
  field: string;
  comparison: '=' | '!=' | '>' | '>=' | '<' | '<=';
  value: string | boolean | number | null;
}

interface Filter {
  groupType: "AND" | "OR", 
  values: FilterValue[]
}

export class WrappedActiveEffect {

  private parentInstance: Parent;
  private parentId: string;
  private activeEffect: ActiveEffect;
  private activeEffectId: string;

  public static fromParameters(parentId: string, activeEffectId: string) {
    const wrappedActiveEffect = new WrappedActiveEffect();
    wrappedActiveEffect.parentId = parentId;
    wrappedActiveEffect.activeEffectId = activeEffectId;
    return wrappedActiveEffect;
  }

  public static fromInstance(parent: Parent, activeEffect: ActiveEffect) {
    const wrappedActiveEffect = new WrappedActiveEffect();
    wrappedActiveEffect.parentInstance = parent;
    wrappedActiveEffect.activeEffect = activeEffect;
    return wrappedActiveEffect;
  }

  private getActiveEffect(): ActiveEffect {
    if (this.activeEffect !== undefined) {
      return this.activeEffect;
    }
    let parent = this.parentInstance;
    if (!parent) {
      parent = game.actors.get(this.parentId);
    }
    if (!parent) {
      parent = game.items.get(this.parentId);
    }
    if (!parent) {
      throw new Error('Could not find parent ' + this.parentId);
    }
    return parent.effects.get(this.activeEffectId);
  }

  public getActiveEffectId(): string {
    const effect = this.getActiveEffect();
    if (!effect) {
      return null;
    }
    return effect.data._id;
  }

  public isEnabled(): boolean {
    const effect = this.getActiveEffect();
    if (!effect) {
      return false;
    }
    return !effect.data.disabled;
  }

  public getParent(): Parent {
    const effect = this.getActiveEffect();
    if (!effect || !effect.data || !effect.data.origin) {
      return null;
    }
    const regResponse = effect.data.origin.match(/^Actor\.([^\.]+)\.OwnedItem\.(.+)$/);
    if (regResponse === null) {
      return null;
    }

    let actor: Actor;
    if (this.parentInstance && this.parentInstance.data._id === regResponse[1]) {
      actor = this.parentInstance as Actor;
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

    return this.validateFilters(effect.getFlag(flagScope, 'filters')).normalizedFilters;
  }

  public matchesFilters(): boolean {
    const filters = this.readFilters();
    if (filters == null || filters.values.length === 0) {
      return true;
    }

    const source = this.getParent();
    if (source === null) {
      // TODO is false correct? should only happen if it is deleted
      return false;
    }

    let rawRollData: any;
    if (source instanceof Actor) {
      rawRollData = source.getRollData();
    }
    if (!rawRollData) {
      // When the item is not linked to an actor
      return false;
    }
    const rollData = flattenObject(rawRollData);
    let foundAnyMatch = false;
    for (const filterValue of filters.values) {
      let sourceValue = rollData[filterValue.field];
      if (sourceValue === "") {
        sourceValue = null;
      }
      let matches = false;
      switch (filterValue.comparison) {
        case '=':
          matches = sourceValue == filterValue.value;
          break;
        case '!=':
          matches = sourceValue != filterValue.value;
          break;
        case '>=':
          matches = sourceValue >= filterValue.value;
          break;
        case '>':
          matches = sourceValue > filterValue.value;
          break;
        case '<=':
          matches = sourceValue <= filterValue.value;
          break;
        case '<':
          matches = sourceValue < filterValue.value;
          break;
      }

      if (matches) {
        foundAnyMatch = matches;
      }

      if (filters.groupType === 'AND' && !matches) {
        return false;
      } else if (filters.groupType === 'OR' && matches) {
        return true;
      }
    }

    if (filters.groupType === 'AND') {
      // No mismatches found
      return true;
    } else if (filters.groupType === 'OR' && foundAnyMatch) {
      // No matches found
      return false;
    }
  }

  /**
   * Validate if a filter is valid
   */
  public validateFilters(filters: Filter): {valid: true, normalizedFilters: Filter} | {valid: false, normalizedFilters: null, errorMessage: string} {
    if (filters === null || filters === undefined) {
      return {valid: true, normalizedFilters: null}
    }

    const normalizedFilters: any = {};
    if (typeof filters !== 'object' || Array.isArray(filters)) {
      return {valid: false, normalizedFilters: null, errorMessage: "Invalid: Filter needs to be an object: " + JSON.stringify(filters)};
    }
    if (!filterGroupTypes.includes(filters.groupType)) {
      return {valid: false, normalizedFilters: null, errorMessage: "Invalid filter.groupType: " + JSON.stringify(filters)};
    }
    normalizedFilters.groupType = filters.groupType;
    if (!Array.isArray(filters.values)) {
      return {valid: false, normalizedFilters: null, errorMessage: "Invalid filter.values: " + JSON.stringify(filters)};
    }
    normalizedFilters.values = [];

    for (let i = 0; i < filters.values.length; i++) {
      const normalizedValue = {
        field: filters.values[i].field,
        comparison: filters.values[i].comparison,
        value: filters.values[i].value
      };
      if (normalizedValue.value === undefined) {
        normalizedValue.value = null;
      }
      if (normalizedValue.value === "") {
        normalizedValue.value = null;
      }
      if (typeof normalizedValue.field !== 'string') {
        return {valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].field: "` + JSON.stringify(filters)};
      }
      if (!filterComparisonTypes.includes(normalizedValue.comparison)) {
        return {valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].comparison: "` + JSON.stringify(filters)};
      }
      if (!filterValueTypes.includes(typeof normalizedValue.value)) {
        return {valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].value: "` + JSON.stringify(filters)};
      }
      normalizedFilters.values.push(normalizedValue);
    }
    return {valid: true, normalizedFilters: normalizedFilters}
  }

  public async writeFilters(filters: Filter | null): Promise<any> {
    /* Validate */
    const validateResult = this.validateFilters(filters);
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