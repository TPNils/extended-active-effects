const featureItemTypes = () => ['class', 'equipment', 'feat', 'weapon'];
const spellItemTypes = () => ['spell'];
const supportedItemTypes = () => [...featureItemTypes(), ...spellItemTypes()].sort();
const supportedAutoApplyParentTypes = () => ['character', 'npc'];
const Types = {
    featureItemTypes: featureItemTypes,
    spellItemTypes: spellItemTypes,
    supportedItemTypes: supportedItemTypes,
    supportedAutoApplyParentTypes: supportedAutoApplyParentTypes,
};
export { Types };
