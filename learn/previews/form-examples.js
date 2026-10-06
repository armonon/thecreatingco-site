const cad = (title, project, poster) => ({title, project, poster, workspace:'cad'});
const fabric = (title, id) => ({title, project:`/assets/form-fashion/${id==='tee'?'tshirt':id}-starter.formgarment`, poster:`/assets/form-fashion/${id==='pattern'?'skirt-pattern':id==='tee'?'tee-sewn':'dress-silk'}.jpg`, workspace:'fabric'});
export const formExamples = {
  architecture: cad('Studio House','/assets/form-architecture/starter.form','/assets/form-architecture/house-editor.jpg'),
  jewelry: cad('Orbit pendant','/assets/form-jewelry/orbit-32-2p4.form','/assets/form-jewelry/orbit-form-model.jpg'),
  twist: cad('Ripple vessel','/assets/form-lessons/ripple-vessel.form','/assets/form-lessons/ripple-vessel.jpg'),
  lamp: cad('Lumen shade','/assets/form-lessons/lumen-lamp.form','/assets/form-lessons/lumen-lamp.jpg'),
  array: cad('Ribbon pavilion','/assets/form-lessons/arch-array.form','/assets/form-lessons/arch-array.jpg'),
  sculpt: cad('Equine Reverie','/assets/form-studies/equine-reverie.form','/assets/form-studies/equine-perspective.jpg'),
  relief: cad('Birds in Orbit','/assets/form-studies/wwspc.form','/assets/form-studies/birds-perspective.jpg'),
  terrain: cad('Forest landscape','/assets/form-studies/forest-landscape.form','/assets/form-studies/terrain-perspective.jpg'),
  circle: cad('Circle of Anarchy','/assets/form-studies/circle-of-anarchy.form','/assets/form-studies/circle-perspective.jpg'),
  pattern: fabric('Pattern study','pattern'),
  tee: fabric('T-shirt study','tee'),
  drape: fabric('Drape study','drape'),
  garment: fabric('Garment sketch studio','drape'),
};
for (const id of ['dimensions','history','challenge','materials','handoff']) {
  formExamples[id] = cad('Orbit clasp','/assets/after-hours/outputs/orbit-clasp.form','/assets/after-hours/outputs/orbit-steel-render.png');
}
formExamples.jewelry.initialView='sketch';
formExamples.dimensions.initialView='sketch';
export const exampleKey = id => `form-example-${id}-v1`;
export function exampleURL(id, embedded = true) {
  if (!Object.hasOwn(formExamples,id)) throw Error('Unknown Form example');
  return `/learn/form/workshops/?lesson=${encodeURIComponent(id)}&embed=${embedded?'box':'studio'}`;
}
