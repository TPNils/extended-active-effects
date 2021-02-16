import { PassiveEffect, PassiveEffectData } from './passive-effect.js';
import { StaticValues } from './static-values.js';
import { CreateElementParam, UtilsHtml } from './utils-html.js';
import { WrappedActiveEffect } from './wrapped-active-effect.js';

const flagScope = StaticValues.moduleName;

export class ExtendActiveEffectService {
  /* public */

  constructor() {
    this._hooks = [
      {
        name: 'renderActiveEffectConfig',
        callback: this._onRenderActiveEffectConfig.bind(this)
      },
      {
        name: 'renderDAEActiveEffectConfig',
        callback: this._onRenderActiveEffectConfig.bind(this)
      },
      {
        name: 'createActiveEffect',
        callback: this._onCreateActiveEffect.bind(this)
      },
      {
        name: 'updateActiveEffect',
        callback: this._onUpdateActiveEffect.bind(this)
      },
      {
        name: 'updateActor',
        callback: this._onUpdateActor.bind(this)
      },
      {
        name: 'deleteActiveEffect',
        callback: this._onDeleteActiveEffect.bind(this)
      },
      {
        name: 'preDeleteOwnedItem',
        callback: this._onPreDeleteOwnedItem.bind(this)
      },
      {
        name: 'preUpdateOwnedItem',
        callback: this._onPreUpdateOwnedItem.bind(this)
      },
      {
        name: 'createOwnedItem',
        callback: this._onCreateOwnedItem.bind(this)
      },
      {
        name: 'deleteOwnedItem',
        callback: this._onDeleteOwnedItem.bind(this)
      },
      {
        name: 'updateOwnedItem',
        callback: this._onUpdateOwnedItem.bind(this)
      }
    ];
  }

  public register(): void {
    if (this._started) {
      throw new Error("Service already registered");
    }

    // Register hooks
    for (const hook of this._hooks) {
      if (!hook.id) {
        hook.id = Hooks.on(hook.name, hook.callback);
        // debug
        // hook.id = Hooks.on(hook.name, (...args: any[]) => console.log(hook.name, args));
      }
    }

    this._started = true;
  }

  public unregister(): void {
    if (!this._started) {
      throw new Error("Service not yet registered");
    }

    // Unegister hooks
    for (const hook of this._hooks) {
      if (hook.id) {

      }
      Hooks.off(hook.name, hook.id)
      delete hook.id;
    }
    
    this._started = false;
  }

  private _started = false;
  private _hooks = [];

  private _onRenderActiveEffectConfig(controller: any, html: HTMLElement, activeEffectContainer: any): void {
    const activeEffect = new WrappedActiveEffect(
      controller.object.parent instanceof Actor ? {actorId: controller.object.parent.data._id} : {itemId: controller.object.parent.data._id},
      {activeEffectId: activeEffectContainer.effect._id}
    )

    /* Navigation */
    const renderNavigation = () => {
      const nav = html[0].querySelector('nav.tabs');
      const baseNavElement = nav.firstElementChild.cloneNode(true);
      baseNavElement.className = baseNavElement.className.split(' ').filter(className => className !== 'active').join(' ');
      baseNavElement.removeAttribute('data-tab');
      
      const currentFeaturesNav = nav.querySelector('[data-tab="features"]');
      if (!currentFeaturesNav) {
        const featuresNavElement = baseNavElement.cloneNode(true);
        featuresNavElement.childNodes.forEach(child => {
          if (child.nodeName === '#text') {
            child.textContent = ' ' + (game.i18n.translations as any).DND5E.Features;
          }
        });
        featuresNavElement.setAttribute('data-tab', 'features');
        const featuresIcon = featuresNavElement.querySelector('i');
        featuresIcon.className = 'fas fa-feather-alt';
        nav.appendChild(featuresNavElement);
      }
      
      const currentSpellsNav = nav.querySelector('[data-tab="spells"]');
      if (!currentSpellsNav) {
        const spellsNavElement = baseNavElement.cloneNode(true);
        spellsNavElement.childNodes.forEach(child => {
          if (child.nodeName === '#text') {
            child.textContent = ' ' + (game.i18n.translations as any).DND5E.Spellbook;
          }
        });
        spellsNavElement.setAttribute('data-tab', 'spells');
        const spellsIcon = spellsNavElement.querySelector('i');
        spellsIcon.className = 'fas fa-magic';
        nav.appendChild(spellsNavElement);
      }

    };
    renderNavigation();

    /* Body */
    const renderBody = () => {
      const currentFeaturesSection = html[0].querySelector('form section[data-tab="features"]');
      let featuresSection;
      if (currentFeaturesSection) {
        featuresSection = currentFeaturesSection.cloneNode(false);
      } else {
        featuresSection = UtilsHtml.createElement({
          tagName: 'section',
          classes: ['tab'],
          attributes: {
            'data-tab': 'features'
          }
        });
      }
      
      const currentSpellSection = html[0].querySelector('form section[data-tab="spells"]');
      let spellsSection;
      if (currentSpellSection) {
        spellsSection = currentSpellSection.cloneNode(false);
      } else {
        spellsSection = UtilsHtml.createElement({
          tagName: 'section',
          classes: ['tab'],
          attributes: {
            'data-tab': 'spells'
          }
        });
      }
      const featuresListElement: CreateElementParam = {
        tagName: 'ol',
        classes: ['extended-active-effects'],
        children: []
      };
      const spellListElement: CreateElementParam = {
        tagName: 'ol',
        classes: ['extended-active-effects'],
        children: []
      };
  
      for (const item of activeEffect.readActiveEffectItems()) {
        const itemEntry: CreateElementParam = {
          tagName: 'li',
          children: [
            {
              tagName: 'div',
              classes: ['container'],
              children: [
                {
                  tagName: 'img', 
                  classes: ['item-image'], 
                  attributes: {'src': item.data.img}
                },
                {
                  tagName: 'h4', 
                  classes: ['name'], 
                  children: [
                    {text: item.data.name}
                  ]
                },
                {
                  tagName: 'a', 
                  children: [
                    {
                      tagName: 'i',
                      classes: ['fas', 'fa-trash'],
                      listeners: [
                        {
                          event: 'click', 
                          listener: () => activeEffect.deleteItem(item).then(() => renderBody())
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };
        
        if (StaticValues.featureItemTypes.includes(item.data.type)) {
          featuresListElement.children.push(itemEntry);
        } else if (StaticValues.spellItemTypes.includes(item.data.type)) {
          spellListElement.children.push(itemEntry);
        }
      }

      const addItemListItem = document.createElement('li');
      const addItemElement = document.createElement('div');
      addItemElement.className = 'add';
      addItemElement.textContent = 'Drag & Drop';
      addItemListItem.appendChild(addItemElement);
      
      featuresListElement.children.push(addItemListItem.cloneNode(true));
      spellListElement.children.push(addItemListItem.cloneNode(true));

      featuresSection.appendChild(UtilsHtml.createElement(featuresListElement));
      spellsSection.appendChild(UtilsHtml.createElement(spellListElement));

      if (currentFeaturesSection) {
        currentFeaturesSection.remove();
      }
      if (currentSpellSection) {
        currentSpellSection.remove();
      }
  
      const lastSection = html[0].querySelector('form section:last-of-type');
      lastSection.insertAdjacentElement('afterend', featuresSection);
      featuresSection.insertAdjacentElement('afterend', spellsSection);
    };
    renderBody();
    
    /* HTML listeners */
    const form = html[0].querySelector(`form:not([${flagScope}-drop])`);
    // Method may be called multiple times with DynamicActiveEffects, so ensure event listeners are not added twice
    if (form) {
      form.setAttribute(`${flagScope}-drop`, true);
      form.addEventListener('drop', event => this._getDropItem(event).then(item => {
        const validateResult = activeEffect.validateItem(item);
        if (validateResult.valid === false) {
          ui.notifications.error(validateResult.errorMessage);
          return;
        }
        activeEffect.addItem(item).then(() => {
          renderBody();

          // Focus to the drop tab
          let shouldBeActiveType;
          if (StaticValues.featureItemTypes.includes(item.type)) {
            shouldBeActiveType = 'features';
          } else if (StaticValues.spellItemTypes.includes(item.type)) {
            shouldBeActiveType = 'spells';
          }

          if (!shouldBeActiveType) {
            return
          }

          const currentActive = html[0].querySelector('form section.active');
          const shouldBeActive = html[0].querySelector(`form section[data-tab=${shouldBeActiveType}]`);

          if (currentActive !== shouldBeActive) {
            currentActive.className = currentActive.className.split(' ').filter(className => className !== 'active').join(' ');
            shouldBeActive.className = [...shouldBeActive.classList, 'active'].join(' ');
          }

        });
      }));
    }
    
  }

  private _onCreateActiveEffect(parent, activeEffect, options, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.effects = actorData.effects ? actorData.effects : [];
    actorData.effects.push(activeEffect);
    this._calcApplyActorItems(new Actor(actorData, null));
  }
  private _onUpdateActiveEffect(parent, activeEffect, options, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.effects = actorData.effects ? actorData.effects : [];
    actorData.effects = actorData.effects.map(effect => {
      if (effect._id === activeEffect._id) {
        return activeEffect;
      } else {
        return effect;
      }
    });
    this._calcApplyActorItems(new Actor(actorData, null));
  }
  private _onDeleteActiveEffect(parent, activeEffect, options, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.effects = actorData.effects ? actorData.effects : [];
    actorData.effects = actorData.effects.filter(effect => effect._id !== activeEffect._id);
    this._calcApplyActorItems(new Actor(actorData, null));
  }
  private  _onUpdateActor(actor: Actor<any>, difference: Partial<Actor.Data<any>>, options, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(actor.data.type)) {
      return;
    }
    
    let recalc = false;
    if (!recalc) {
      recalc = !options.diff;
    }
    // If the diff tracker is on, don't update if the item's didn't update
    if (!recalc) {
      recalc = !!difference.items;
    }
    if (!recalc && difference?.flags[StaticValues.moduleName]) {
      if (difference?.flags[StaticValues.moduleName].passiveEffects) {
        recalc = true;
      } else if (difference?.flags[StaticValues.moduleName]['-=passiveEffects'] !== undefined) {
        recalc = true;
      }
    }

    if (recalc) {
      this._calcApplyActorItems(actor);
    }
  }

  private _onPreDeleteOwnedItem(parent: Actor, ownedItem: any, options, userId: string): boolean {
    if (ownedItem.flags && ownedItem.flags[flagScope] && ownedItem.flags[flagScope].effectItemKey) {
      const effectId = ownedItem.flags[flagScope].effectItemKey.replace(/\.[0-9]+$/g, '');
      const activeEffect = new WrappedActiveEffect({actorId: parent.data._id}, {activeEffectId: effectId})
      if (activeEffect.isEnabled()) {
        const source = activeEffect.getParent();
        ui.notifications.error("This item is automatically assigned and can't be removed manually." + (source ? ` Source: ${source.data.name}` : ""));
        return false;
      }
    }
    return true;
  }
  private _onPreUpdateOwnedItem(parent: Actor, ownedItem: any, difference: Partial<Item<any>>, options, userId: string): boolean {
    if (ownedItem.flags && ownedItem.flags[flagScope] && ownedItem.flags[flagScope].effectItemKey) {
      const effectId = ownedItem.flags[flagScope].effectItemKey.replace(/\.[0-9]+$/g, '');
      const activeEffect = new WrappedActiveEffect({actorId: parent.data._id}, {activeEffectId: effectId})
      if (activeEffect.isEnabled()) {
        // TODO should update be supported? keeping track of charges
        const source = activeEffect.getParent();
        ui.notifications.error("This item is automatically assigned and can't be updated manually." + (source ? ` Source: ${source.data.name} (${source.data.type})` : ""));
        return false;
      }
    }
    return true;
  }
  private _onCreateOwnedItem(parent: Actor, ownedItem: Item.Data<any>, difference, options: Partial<Item<any>>, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.items = actorData.items ? actorData.items : [];
    actorData.items.push(ownedItem);
    this._calcApplyActorItems(new Actor(actorData, null));
  }
  private _onUpdateOwnedItem(parent: Actor, ownedItem: Item.Data<any>, difference, options: Partial<Item<any>>, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.items = actorData.items ? actorData.items : [];
    actorData.items = actorData.items.map(item => {
      if (item._id === ownedItem._id) {
        return ownedItem;
      } else {
        return item;
      }
    });
    this._calcApplyActorItems(new Actor(actorData, null));
  }
  private _onDeleteOwnedItem(parent: Actor, ownedItem: Item.Data<any>, options: Partial<Item<any>>, userId: string): void {
    if (!StaticValues.supportedAutoApplyParentTypes.includes(parent.data.type)) {
      return;
    }
    const actorData = JSON.parse(JSON.stringify(parent.data));
    actorData.items = actorData.items ? actorData.items : [];
    actorData.items = actorData.items.filter(item => item._id !== ownedItem._id);
    this._calcApplyActorItems(new Actor(actorData, null));
  }

  private _calcApplyActorItems(actor: Actor): void {
    const upsertItemsByKey = new Map();
    (actor as any).effects.forEach((effect: ActiveEffect, effectId: string) => {
      const activeEffect = new WrappedActiveEffect({actor: actor}, {activeEffect: effect});
      if (activeEffect.isEnabled()) {
        for (const item of activeEffect.readActiveEffectItems()) {
          upsertItemsByKey.set(effectId + '.' + item.wrappedId, item.data);
        }
      }
    });
    PassiveEffect.getPassiveEffects(actor).forEach((effect: PassiveEffect, effectId: string) => {
      const activeEffect = new WrappedActiveEffect({actor: actor}, {passiveEffect: effect});
      if (activeEffect.isEnabled()) {
        for (const item of activeEffect.readActiveEffectItems()) {
          upsertItemsByKey.set(effectId + '.' + item.wrappedId, item.data);
        }
      }
    });

    let itemsAdded = [];
    let itemsDeleted = [];
    const newItemList = [];
    const appliedItemsByKey = new Map();
    actor.items.forEach((item) => {
      const key = item.getFlag(flagScope, 'effectItemKey');
      if (!key) {
        newItemList.push(item.data);
      } else {
        appliedItemsByKey.set(key, item.data);
        if (!upsertItemsByKey.has(key)) {
          itemsAdded.push(item.data);
        }
      }
    });

    upsertItemsByKey.forEach((itemData, key) => {
      if (appliedItemsByKey.has(key)) {
        newItemList.push(appliedItemsByKey.get(key));
      } else {
        if (!itemData.flags) {
          itemData.flags = {};
        }
        if (!itemData.flags[flagScope]) {
          itemData.flags[flagScope] = {};
        }
        itemData.flags[flagScope].effectItemKey = key;
        newItemList.push(itemData);
        itemsAdded.push(itemData);
      }
    });

    if (itemsAdded.length > 0 || itemsDeleted.length > 0) {
      Actor.update({_id: actor._id, items: newItemList});
    }
  }

  /**
   * @returns {any} item data
   */
  private _getDropItem(dropEvent: any | null): Promise<any> {
    const rawDropData = dropEvent.dataTransfer.getData('text/plain');
    if (!rawDropData) {
      return Promise.resolve(null);
    }
    try {
      const dropData = JSON.parse(dropEvent.dataTransfer.getData('text/plain'));
      if (dropData.type === 'Item') {
        if (dropData.pack) {
          // Drag from compendium
          return game.packs.get(dropData.pack).getEntity(dropData.id);
        } else if (typeof dropData.data === 'object') {
          // Raw data is present, could happen when dragging from an actor inventory
          return Promise.resolve(game.items.get(dropData.data));
        } else {
          // Drag from item directory
          return Promise.resolve(game.items.get(dropData.id));
        }
      }
    } catch(e) {
      if (e instanceof SyntaxError) {
        return Promise.resolve(null);
      } else {
        return Promise.reject(e);
      }
    }
    return Promise.resolve(null);
  }
  
}
