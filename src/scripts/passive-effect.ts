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
  transfer?: boolean; // unset === true
  icon?: string;
  label?: string;
  origin?: string;
  tint?: string;
}

export interface PassiveEffectData extends Omit<ActiveEffectData, 'disabled'> {
  filter: any; // TODO
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
    this.data.origin = `${this.getParentTypeName()}.${this.parent.id}`;
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
        filteredEffects.push({
          ...data,
          _id: this.data._id,
          origin: data.origin ? data.origin : `${this.getParentTypeName()}.${this.parent.id}`
        });
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

  private getParentTypeName(): string {
    // TODO this isn't perfect
    return this.parent instanceof Actor ? 'Actor' : 'Item';
  }

  private static readFlag(entity: Entity): PassiveEffectFlag {
    return this.readFlagFromData(entity.data);
  }

  private static readFlagFromData(entity: Entity.Data<any>): PassiveEffectFlag {
    let passiveEffectFlag: PassiveEffectFlag = entity?.flags?.[StaticValues.moduleName]?.passiveEffects;
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

  public static calcPassiveEffectsFromEmbeded(entity: Entity): Promise<any> {
    // TODO this isn't perfect
    const entityFlags = this.readFlag(entity);
    const originType = entity instanceof Actor ? 'Actor' : 'Item';
    const entityOrigin = `${originType}.${entity.id}`;

    const effectCollection: PassiveEffectData[] = [];
    for (const passiveEffect of entityFlags.passiveEffects) {
      if (!passiveEffect.origin || passiveEffect.origin === entityOrigin) {
        // no origin = probably from the entity itself
        effectCollection.push(passiveEffect);
      }
    }
    
    // TODO this is bad, can infinit loop update self
    // => Altough can it? saving an OwnedItem triggers a recalc & save on actor, it should end here
    // => save them seperately?
    const config = ((entity.constructor as any).config as Entity.Config).embeddedEntities;
    for (const entityName in config) {
      if (Object.prototype.hasOwnProperty.call(config, entityName)) {
        const embeddedEntities: Entity.Data<any>[] = entity.getEmbeddedCollection(entityName);
        for (const embeddedEntity of embeddedEntities) {
          for (const passiveEffect of this.readFlagFromData(embeddedEntity).passiveEffects) {
            if (passiveEffect.transfer !== false) {
              effectCollection.push({
                ...passiveEffect,
                _id: `${entityOrigin}.${entityName}.${embeddedEntity._id}.PassiveEffect.${passiveEffect._id}`,
                origin: `${entityOrigin}.${entityName}.${embeddedEntity._id}`
              });
            }
          }
        }
      }
    }

    return this.writeFlag(entity, {
      nextId: entityFlags.nextId,
      passiveEffects: effectCollection
    });
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


export class PassiveEffectService {
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
      originalEffects.forEach(effect => {
        activeAndPassiveEffects.set(effect.data._id, effect);
      });
      PassiveEffect.getPassiveEffects(this).forEach(effect => {
        activeAndPassiveEffects.set(effect.data._id, effect);
      });
      this.effects = activeAndPassiveEffects;
      service.originalActorApplyActiveEffects.call(this);
      this.effects = originalEffects;
    }
  }

  // TODO apply passive effects
  public onOwnedItemCreate(parent: Actor, ownedItemData: Item.Data<any>, options: any, userId: string): void {
    PassiveEffect.calcPassiveEffectsFromEmbeded(parent);
  }

  public onOwnedItemUpdate(parent: Actor, ownedItemData: Item.Data<any>, difference: any, options: any, userId: string): void {
    PassiveEffect.calcPassiveEffectsFromEmbeded(parent);
  }

  public onOwnedItemDelete(parent: Actor, ownedItemData: Item.Data<any>, options: any, userId: string): void {
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.items = actorData.items ? actorData.items : [];
    actorData.items = actorData.items.filter(item => item._id !== ownedItemData._id);
    PassiveEffect.calcPassiveEffectsFromEmbeded(new Actor(actorData, null));
  }

  public onUpdateActor(actor: Actor<any>, difference: Partial<Actor.Data<any>>, options: any, userId: string): void {
    if (!options.diff) {
      PassiveEffect.calcPassiveEffectsFromEmbeded(actor);
      return;
    }

    if (difference.items && difference.items.length > 0) {
      for (const itemData of difference.items) {
        if (itemData?.flags[StaticValues.moduleName]?.passiveEffects) {
          PassiveEffect.calcPassiveEffectsFromEmbeded(actor);
          return;
        }
      }
    }
  }

}

const passiveEffectService = new PassiveEffectService();

export function init(): void {
  Hooks.on('createOwnedItem', passiveEffectService.onOwnedItemCreate.bind(passiveEffectService));
  Hooks.on('updateOwnedItem', passiveEffectService.onOwnedItemUpdate.bind(passiveEffectService));
  Hooks.on('deleteOwnedItem', passiveEffectService.onOwnedItemDelete.bind(passiveEffectService));
  Hooks.on('updateActor', passiveEffectService.onUpdateActor.bind(passiveEffectService));

  Hooks.on('init', () => {
    passiveEffectService.injectIntoActor();
    
    game[StaticValues.moduleName] = {
      PassiveEffect: PassiveEffect,
    }
  })
}