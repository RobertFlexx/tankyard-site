import assert from 'node:assert/strict';
import { gateOpen, logicState, stepLogic, vaultDemo } from '../js/workshop-logic.js';
for (const [a,b,and,or,xor] of [[0,0,false,false,false],[1,0,false,true,true],[0,1,false,true,true],[1,1,true,true,false]]) {
  for (const [type,expected] of [['and',and],['or',or],['xor',xor]]) assert.equal(gateOpen(type,[a,b]),expected,`${type} ${a} ${b}`);
}
const objects=vaultDemo();
const original=JSON.stringify(objects);
const state={x:100,y:700,hidden:{},...logicState()};
function visit(x,y,now){state.x=x;state.y=y;return stepLogic(objects,state,now);}
assert.equal(visit(340,540,1),true);
assert.deepEqual(state.counters.slice(0,2),[1,0]);
assert.equal(state.gateHidden.has(1),false);
assert.equal(visit(340,540,2),false,'remaining on a lever must not toggle each frame');
visit(600,700,2.1);
visit(860,540,3);
assert.deepEqual(state.counters.slice(0,2),[1,1]);
assert.equal(state.gateHidden.has(1),true);
visit(600,700,3.1);
visit(340,540,4);
assert.equal(state.gateHidden.has(1),false,'leaving one input off closes the AND vault');
visit(600,700,4.1);
assert.equal(visit(340,540,4.2),false,'the one-second rest time prevents double toggles');
assert.equal(JSON.stringify(objects),original,'playtests must not mutate the saved map');
assert.deepEqual(logicState().counters,Array(8).fill(0),'a new playtest clears all inputs');
const plate={kind:'logic',type:'plate',group:3,x:0,y:0,w:100,h:100};
visit(10,10,5);
stepLogic([plate],state,5);
assert.equal(state.hidden[3],10,'ordinary plate behavior is preserved');
console.log('Workshop gate truth tables, crossings, cooldown, reset and plate compatibility passed.');
