var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { staticValues } from "./static-values";
import { Types } from "./Types";
// Might be relevant for 'natural' equipment and weapons
const filterGroupTypes = ['AND', 'OR'];
const filterComparisonTypes = ['=', '!=', , '>', '>=', '<', '<='];
const filterValueTypes = ['null', 'string', 'number', 'boolean'];
const flagScope = staticValues.moduleName;
export class WrappedActiveEffect {
    static fromParameters(parentId, activeEffectId) {
        const wrappedActiveEffect = new WrappedActiveEffect();
        wrappedActiveEffect._parentId = parentId;
        wrappedActiveEffect._activeEffectId = activeEffectId;
        return wrappedActiveEffect;
    }
    static fromInstance(actor, activeEffect) {
        const wrappedActiveEffect = new WrappedActiveEffect();
        wrappedActiveEffect._actor = actor;
        wrappedActiveEffect._activeEffect = activeEffect;
        return wrappedActiveEffect;
    }
    _getActiveEffect() {
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
    getId() {
        const effect = this._getActiveEffect();
        if (!effect) {
            return null;
        }
        return effect.data._id;
    }
    isEnabled() {
        const effect = this._getActiveEffect();
        if (!effect) {
            return false;
        }
        return !effect.data.disabled;
    }
    getSource() {
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
        }
        else {
            actor = game.actors.get(regResponse[1]);
        }
        return actor.items.get(regResponse[2]);
    }
    /**
     * @returns {{wrappedId: number, data: any}[]}, where data is the items that have been added
     */
    readActiveEffectItems() {
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
    readFilters() {
        const effect = this._getActiveEffect();
        if (!effect) {
            return null;
        }
        return this.validateFilters(effect.getFlag(flagScope, 'filters')).normalizedFilters;
    }
    matchesFilters() {
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
            }
            else if (filters.groupType === 'OR' && matches) {
                return true;
            }
        }
        if (filters.groupType === 'AND') {
            // No mismatches found
            return true;
        }
        else if (filters.groupType === 'OR' && foundAnyMatch) {
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
    validateFilters(filters) {
        if (filters === null || filters === undefined) {
            return { valid: true, normalizedFilters: null };
        }
        const normalizedFilters = {};
        if (typeof filters !== 'object' || Array.isArray(filters)) {
            return { valid: false, normalizedFilters: null, errorMessage: "Invalid: Filter needs to be an object: " + JSON.stringify(filters) };
        }
        if (!filterGroupTypes.includes(filters.groupType)) {
            return { valid: false, normalizedFilters: null, errorMessage: "Invalid filter.groupType: " + JSON.stringify(filters) };
        }
        normalizedFilters.groupType = filters.groupType;
        if (!Array.isArray(filters.values)) {
            return { valid: false, normalizedFilters: null, errorMessage: "Invalid filter.values: " + JSON.stringify(filters) };
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
                return { valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].field: "` + JSON.stringify(filters) };
            }
            if (!filterComparisonTypes.includes(normalizedValue.comparison)) {
                return { valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].comparison: "` + JSON.stringify(filters) };
            }
            if (!filterValueTypes.includes(typeof normalizedValue.value)) {
                return { valid: false, normalizedFilters: null, errorMessage: `"Invalid filter.values[${i}].value: "` + JSON.stringify(filters) };
            }
            normalizedFilters.values.push(normalizedValue);
        }
        return { valid: true, normalizedFilters: normalizedFilters };
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
    writeFilters(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            /* Validate */
            const validateResult = this.validateFilters(filters);
            if (!validateResult.valid) {
                throw new Error(validateResult.errorMessage);
            }
            /* Execute */
            const activeEffect = this._getActiveEffect();
            return activeEffect.setFlag(flagScope, "filters", validateResult.normalizedFilters);
        });
    }
    /**
     * Validate if an item can be added
     * @param {*} item
     * @return {{valid: boolean, errorMessage?: string}}
     */
    validateItem(item) {
        if (!item || !Types.supportedItemTypes().includes(item.type)) {
            return { valid: false, errorMessage: 'Supported items: ' + Types.supportedItemTypes().sort().join(', ') };
        }
        return { valid: true };
    }
    /**
     * @param {*} item
     */
    addItem(item) {
        return __awaiter(this, void 0, void 0, function* () {
            const validateResult = this.validateItem(item);
            if (!validateResult.valid) {
                throw new Error(validateResult.errorMessage);
            }
            const items = this.readActiveEffectItems();
            items.push({ data: item });
            return this.writeActiveEffectItems(items);
        });
    }
    /**
     * @param {{wrappedId: number, data?: any} | number} itemOrId
     */
    deleteItem(itemOrId) {
        return __awaiter(this, void 0, void 0, function* () {
            let id;
            if (Number.isInteger(itemOrId)) {
                id = itemOrId;
            }
            else {
                id = itemOrId.wrappedId;
            }
            return this.writeActiveEffectItems(this.readActiveEffectItems().filter(item => item.wrappedId !== id));
        });
    }
    /**
     * @param {{wrappedId?: number, data: any}[]} items
     */
    writeActiveEffectItems(items) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
}
