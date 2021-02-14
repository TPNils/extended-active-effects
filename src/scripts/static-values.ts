const StaticValues = {
  moduleName: "extended-active-effects",
  featureItemTypes: ['class', 'equipment', 'feat', 'weapon'],
  spellItemTypes: ['spell'],
  supportedItemTypes: [''],
  supportedAutoApplyParentTypes: ['character', 'npc'],
};
StaticValues.supportedItemTypes = [...StaticValues.featureItemTypes, ...StaticValues.spellItemTypes]

Object.freeze(StaticValues);
for (const key in StaticValues) {
  if (Object.prototype.hasOwnProperty.call(StaticValues, key)) {
    Object.freeze(StaticValues[key]);
  }
}

export {StaticValues}; 