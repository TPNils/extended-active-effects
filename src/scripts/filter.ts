
export namespace Filter {
  export interface Condition {
    field: string;
    comparison: '=' | '!=' | '>' | '>=' | '<' | '<=';
    value: string | boolean | number | null;
  }
  
  export interface Group {
    groupType: "AND" | "OR";
    conditions: Condition | Condition[] | Group | Group[];
  }
}

export interface Filter {
  matches(data: {[key: string]: any}): boolean;
}

class FilterImpl implements Filter {

  constructor(
    private readonly data: Filter.Group
  ){}

  public matches(data: {[key: string]: any}): boolean {
    if (!this.data) {
      return true;
    }
    return FilterImpl.matchesGroup(flattenObject(data), this.data);
  }

  private static matchesGroup(flatData: Record<string, any>, group: Filter.Group): boolean {
    switch (group?.groupType) {
      case 'AND': 
        return this.matchesAnd(flatData, Array.isArray(group.conditions) ? group.conditions : [group.conditions]);
      case 'OR': 
        return this.matchesOr(flatData, Array.isArray(group.conditions) ? group.conditions : [group.conditions]);
      default: 
        return false;
    }
  }

  private static matchesAnd(flatData: Record<string, any>, conditions: (Filter.Condition | Filter.Group)[]): boolean {
    for (const condition of conditions) {
      if (!this.matchesCondition(flatData, condition)) {
        return false;
      }
    }

    return true;
  }

  private static matchesOr(flatData: Record<string, any>, conditions: (Filter.Condition | Filter.Group)[]): boolean {
    for (const condition of conditions) {
      if (this.matchesCondition(flatData, condition)) {
        return true;
      }
    }

    return false;
  }

  private static matchesCondition(flatData: Record<string, any>, condition: Filter.Condition | Filter.Group): boolean {
    if (this.isGroup(condition)) {
      return this.matchesGroup(flatData, condition);
    }
    let sourceValue = flatData[condition.field];
    switch (condition?.comparison) {
      case '=':
        return sourceValue == condition.value;
      case '!=':
        return sourceValue != condition.value;
      case '>=':
        return sourceValue >= condition.value;
      case '>':
        return sourceValue > condition.value;
      case '<=':
        return sourceValue <= condition.value;
      case '<':
        return sourceValue < condition.value;
      default: 
        return false;
    }
  }

  private static isGroup(condition: any): condition is Filter.Group {
    const keys = Object.keys(condition);
    if (keys.length !== 2) {
      return false;
    }
    return ['AND', 'OR'].includes(condition.groupType) && Object.hasOwnProperty.call(condition, 'conditions');
  }

}

export function readFilter(data: any): {valid: true, normalizedFilters: Filter} | {valid: false, normalizedFilters: null, errorMessage: string} {
  // TODO validation
  return {
    valid: true,
    normalizedFilters: new FilterImpl(data)
  }
}