import { StaticValues } from "./static-values.js";

export interface DurationResult {
  type: 'seconds' | 'turns' | 'none';
  duration: number | null;
  remaining: number | null;
  label: string;
}

export interface ActiveEffectChange {
  key: string;
  value: any;
  mode: number;
  priority: number;
}

export interface ActiveEffectData {
  _id?: string;
  changes: ActiveEffectChange[];
  disabled: boolean;
  duration: {
    seconds?: number;
    startTime?: number;
    rounds?: number;
    turns?: number;
    startRound?: number;
    startTurn?: number;
  };
  flags?: any;
  icon?: string;
  label?: string;
  origin?: string;
  tint?: string;
}

export interface PassiveEffectData extends ActiveEffectData {
}

export interface PassiveEffectFlag {
  nextId: number;
  passiveEffects: PassiveEffectData[];
}

// TODO implement create/update/delete
export class PassiveEffect extends ActiveEffect {

  public data: PassiveEffectData;

  constructor(data: PassiveEffectData, parent: Entity<any>) {
    super(data, parent);
  }

  public get duration(): DurationResult {
    return super.duration;
  }

  public async create(options?: any): Promise<any> {
    if (this.data._id) {
      throw new Error('PassiveEffect already exists');
    }
    const passiveEffectFlag: PassiveEffectFlag = PassiveEffect.readFlag(this.parent);
    this.data._id = `PassiveEffect.${passiveEffectFlag.nextId++}`;
    passiveEffectFlag.passiveEffects.push(this.data);
    return PassiveEffect.writeFlag(this.parent, passiveEffectFlag);
  }

  public async update(data: PassiveEffectData, options?: any): Promise<any> {
    if (!this.data._id) {
      throw new Error('PassiveEffect does not yet exists');
    }
    const passiveEffectFlag: PassiveEffectFlag = PassiveEffect.readFlag(this.parent);
    const filteredEffects: PassiveEffectData[] = [];

    for (const passiveEffect of passiveEffectFlag.passiveEffects) {
      if (passiveEffect._id === this.data._id) {
        filteredEffects.push({...data, _id: this.data._id});
      } else {
        filteredEffects.push(passiveEffect);
      }
    }

    return PassiveEffect.writeFlag(this.parent, {
      nextId: passiveEffectFlag.nextId,
      passiveEffects: filteredEffects
    });
  }

  public async delete(options?: any): Promise<any> {
    if (!this.data._id) {
      throw new Error('PassiveEffect does not yet exists');
    }
    const passiveEffectFlag: PassiveEffectFlag = PassiveEffect.readFlag(this.parent);
    const filteredEffects: PassiveEffectData[] = [];

    for (const passiveEffect of passiveEffectFlag.passiveEffects) {
      if (passiveEffect._id !== this.data._id) {
        filteredEffects.push(passiveEffect);
      }
    }

    return PassiveEffect.writeFlag(this.parent, {
      nextId: passiveEffectFlag.nextId,
      passiveEffects: filteredEffects
    });
  }

  private static readFlag(entity: Entity): PassiveEffectFlag {
    let passiveEffectFlag: PassiveEffectFlag = entity.getFlag(StaticValues.moduleName, 'passiveEffects');
    if (!passiveEffectFlag) {
      passiveEffectFlag = {
        nextId: 0,
        passiveEffects: []
      }
    }

    if (!Array.isArray(passiveEffectFlag.passiveEffects)) {
      passiveEffectFlag.passiveEffects = [];
    }

    if (typeof passiveEffectFlag.nextId !== 'number') {
      let maxId = -1;

      for (const passiveEffect of passiveEffectFlag.passiveEffects) {
        const id = Number.parseInt(passiveEffect._id);
        if (!Number.isNaN(id)) {
          maxId = Math.max(maxId, id);
        }
      }

      passiveEffectFlag.nextId = maxId+1;
    }

    return passiveEffectFlag;
  }

  private static writeFlag(entity: Entity, flag: PassiveEffectFlag): Promise<any> {
    return entity.setFlag(StaticValues.moduleName, 'passiveEffects', flag);
  }

  public static getPassiveEffects(entity: Entity<any>): Collection<PassiveEffect> {
    const passiveEffectFlag: PassiveEffectFlag = this.readFlag(entity);
    const passiveEffects: Collection<PassiveEffect> = new Collection([]);

    for (const passiveEffect of passiveEffectFlag.passiveEffects) {
      passiveEffects.set(passiveEffect._id, new PassiveEffect(passiveEffect, entity));
    }

    return passiveEffects;
  }

  /* Methods for testing */
  public static clearPassiveEffects(entity: Entity<any>): Promise<any> {
    if (!entity) {
      entity = game.actors.get('yKRtF96GrpZH6Tv7');
    }
    return entity.unsetFlag(StaticValues.moduleName, 'passiveEffects');
  }
  public static convertActiveEffectsToPassive(entity?: Entity<any>): Promise<any> {
    if (!entity) {
      entity = game.actors.get('yKRtF96GrpZH6Tv7');
    }
    const passiveEffectFlag: PassiveEffectFlag = PassiveEffect.readFlag(entity);

    if ((entity as any).effects) {
      (entity as any).effects.forEach((effect: ActiveEffect, effectId: string) => {
        passiveEffectFlag.passiveEffects.push({
          ...effect.data,
          disabled: false,
          _id: `PassiveEffect.${passiveEffectFlag.nextId++}`
        });
      });
    }

    return this.writeFlag(entity, passiveEffectFlag);
  }

}
let originalApplyActiveEffects: () => void;
function registerPassiveEffects(): void {
  if (originalApplyActiveEffects) {
    throw new Error('Already registered');
  }

  originalApplyActiveEffects = CONFIG.Actor.entityClass.prototype.applyActiveEffects;
  CONFIG.Actor.entityClass.prototype.applyActiveEffects = function (this: Actor<any>) {
    const originalEffects = this.effects;
    const activeAndPassiveEffects: Collection<ActiveEffect> = new Collection([]);
    originalEffects.forEach(effect => {
      activeAndPassiveEffects.set(effect.data._id, effect);
    });
    PassiveEffect.getPassiveEffects(this).forEach(effect => {
      activeAndPassiveEffects.set(effect.data._id, effect);
    });
    this.effects = activeAndPassiveEffects;
    originalApplyActiveEffects.call(this);
    this.effects = originalEffects;
  }
}

export function init(): void {
  Hooks.on('init', () => {
    registerPassiveEffects();
    
    game[StaticValues.moduleName] = {
      PassiveEffect: PassiveEffect,
    }
  })
}