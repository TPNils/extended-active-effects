import { staticValues } from "./static-values";
import { Types } from "./Types";

// Might be relevant for 'natural' equipment and weapons

const filterGroupTypes = ['AND', 'OR'];
const filterComparisonTypes = ['=', '!=',, '>', '>=', '<', '<='];
const filterValueTypes = ['null', 'string', 'number', 'boolean'];

const flagScope = staticValues.moduleName;

export class WrappedActiveEffect {

  private _parentId: any;
  private _activeEffectId: any;
  private _activeEffect: any;
  private _actor: any;

  public static fromParameters(parentId, activeEffectId) {
    const wrappedActiveEffect = new WrappedActiveEffect();
    wrappedActiveEffect._parentId = parentId;
    wrappedActiveEffect._activeEffectId = activeEffectId;
    return wrappedActiveEffect;
  }

  public static fromInstance(actor, activeEffect) {
    const wrappedActiveEffect = new WrappedActiveEffect();
    wrappedActiveEffect._actor = actor;
    wrappedActiveEffect._activeEffect = activeEffect;
    return wrappedActiveEffect;
  }

  private _getActiveEffect() {
    if (this._activeEffect !== undefined) {
      return this._activeEffect;
    }
    let parent = this._actor;
    if (!parent) {
      parent = game.actors.get(this._parentId);
    }
    if (!parent) {
      parent = game.items.get(this._parentId);
    }
    if (!parent) {
      throw new Error('Could not find parent ' + this._parentId);
    }
    return parent.effects.get(this._activeEffectId);
  }

  public getId(): string {
    const effect = this._getActiveEffect();
    if (!effect) {
      return null;
    }
    return effect.data._id;
  }

  public isEnabled(): boolean {
    const effect = this._getActiveEffect();
    if (!effect) {
      return false;
    }
    return !effect.data.disabled;
  }

  public getSource(): any {
    const effect = this._getActiveEffect();
    if (!effect || !effect.data || !effect.data.origin) {
      return null;
    }
    const regResponse = effect.data.origin.match(/^Actor\.([^\.]+)\.OwnedItem\.(.+)$/);
    if (regResponse === null) {
      return null;
    }

    let actor;
    if (this._actor && this._actor.data._id === regResponse[1]) {
      actor = this._actor;
    } else {
      actor = game.actors.get(regResponse[1]);
    }
    
    return actor.items.get(regResponse[2]);
  }

  /**
   * @returns {{wrappedId: number, data: any}[]}, where data is the items that have been added
   */
  public readActiveEffectItems() {
    const effect = this._getActiveEffect();
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

  /**
   * @returns {{
   *   groupType: "AND" | "OR", 
   *   values: {
   *     field: string,
   *     comparison: '=', '!=',, '>', '>=', '<', '<=',
   *     value: string | boolean | number | null
   *   }[]
   * } | null}
   */
  public readFilters() {
    const effect = this._getActiveEffect();
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

    const source = this.getSource();
    if (source === null) {
      // TODO is false correct? should only happen if it is deleted
      return false;
    }

    const rawRollData = source.getRollData();
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
   * @param {{
   *   groupType: "AND" | "OR", 
   *   values: {
   *     field: string,
   *     comparison: '=', '!=',, '>', '>=', '<', '<=',
   *     value: string | boolean | number | null
   *   }[]
   * } | null} item 
   * @return {{valid: boolean, normalizedFilters: any, errorMessage?: string}}
   */
  public validateFilters(filters) {
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

  /**
   * @param {{
   *   groupType: "AND" | "OR", 
   *   values: {
   *     field: string,
   *     comparison: '=', '!=',, '>', '>=', '<', '<=',
   *     value: string | boolean | number | null
   *   }[]
   * } | null} filters
   */
  public async writeFilters(filters) {
    /* Validate */
    const validateResult = this.validateFilters(filters);
    if (!validateResult.valid) {
      throw new Error(validateResult.errorMessage);
    }

    /* Execute */
    const activeEffect = this._getActiveEffect();
    return activeEffect.setFlag(flagScope, "filters", validateResult.normalizedFilters);
  }

  /**
   * Validate if an item can be added
   * @param {*} item 
   * @return {{valid: boolean, errorMessage?: string}}
   */
  public validateItem(item) {
    if (!item || !Types.supportedItemTypes().includes(item.type)) {
      return {valid: false, errorMessage: 'Supported items: ' + Types.supportedItemTypes().sort().join(', ')};
    }
    return {valid: true};
  }

  /**
   * @param {*} item 
   */
  public async addItem(item) {
    const validateResult = this.validateItem(item);
    if (!validateResult.valid) {
      throw new Error(validateResult.errorMessage);
    }
    
    const items = this.readActiveEffectItems();
    items.push({data: item});
    return this.writeActiveEffectItems(items);
  }

  /**
   * @param {{wrappedId: number, data?: any} | number} itemOrId 
   */
  public async deleteItem(itemOrId) {
    let id;
    if (Number.isInteger(itemOrId)) {
      id = itemOrId;
    } else {
      id = itemOrId.wrappedId;
    }

    return this.writeActiveEffectItems(this.readActiveEffectItems().filter(item => item.wrappedId !== id));
  }

  /**
   * @param {{wrappedId?: number, data: any}[]} items 
   */
  public async writeActiveEffectItems(items) {
    items = items.filter(item => Types.supportedItemTypes().includes(item.data.type));
    for (let i = 0; i < items.length; i++) {
      items[i].data = JSON.parse(JSON.stringify(items[i].data));
      delete items[i].data._id;
    }
    const activeEffect = this._getActiveEffect();
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