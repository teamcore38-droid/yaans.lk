import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateException,permitsNpmFinding,permitsOsvFinding,developmentOnly,advisoryId} from '../../scripts/security-exception-policy.mjs';
import {assertRuntimeModuleBoundary} from '../../scripts/runtime-dependency-boundary.mjs';

const policy=JSON.parse(fs.readFileSync(new URL('../../config/security-exceptions.json',import.meta.url)));
function fixture(){
  const lock={packages:{'node_modules/picomatch':{version:'4.0.7',dev:true},'node_modules/vite':{version:'6.4.5',dev:true}}};
  const locks=[{directory:'frontend',lock}];
  const report={vulnerabilities:{picomatch:{nodes:['node_modules/picomatch'],via:[{name:'picomatch',url:`https://github.com/advisories/${advisoryId}`}]},vite:{nodes:['node_modules/vite'],via:['picomatch']}}};
  return {lock,locks,report};
}
test('exception expires automatically at the Sri Lanka review boundary',()=>{
  assert.doesNotThrow(()=>validateException(policy,new Date('2026-12-17T18:29:59Z')));
  assert.throws(()=>validateException(policy,new Date('2026-12-17T18:30:00Z')),/expired/);
  for(const change of [{advisory:'GHSA-other'},{developmentOnly:false},{directory:'backend'},{versions:['*']},{expiresAt:'2027-01-01'}])assert.throws(()=>validateException({...policy,...change},new Date('2026-11-18')));
});
test('only exact development advisory and its npm propagation paths are accepted',()=>{
  const {lock,locks,report}=fixture();
  assert.equal(permitsNpmFinding('vite',report,'frontend',lock,locks),true);
  assert.equal(permitsNpmFinding('vite',report,'backend',lock,locks),false);
  report.vulnerabilities.picomatch.via.push({name:'picomatch',url:'https://github.com/advisories/GHSA-other'});
  assert.equal(permitsNpmFinding('vite',report,'frontend',lock,locks),false);
});
test('npm missing graph edges, cycles and unknown nodes fail closed',()=>{
  for(const kind of ['missing','cycle','node','empty']){
    const {lock,locks,report}=fixture();
    if(kind==='missing')report.vulnerabilities.vite.via=['absent'];
    if(kind==='cycle')report.vulnerabilities.picomatch.via=['vite'];
    if(kind==='node')report.vulnerabilities.vite.nodes=['missing'];
    if(kind==='empty')report.vulnerabilities.vite.via=[];
    assert.equal(permitsNpmFinding('vite',report,'frontend',lock,locks),false);
  }
});
test('an affected package in any production lock path invalidates acceptance',()=>{
  const {lock,locks,report}=fixture();
  locks.push({directory:'.',lock:{packages:{'node_modules/picomatch':{version:'4.0.7'}}}});
  assert.equal(developmentOnly(locks,'picomatch','4.0.7'),false);
  assert.equal(permitsNpmFinding('vite',report,'frontend',lock,locks),false);
});
test('OSV acceptance rejects other packages, versions and advisory identifiers',()=>{
  const {locks}=fixture();const item={package:{name:'picomatch'},version:'4.0.7'};
  assert.equal(permitsOsvFinding(item,{id:advisoryId},locks),true);
  assert.equal(permitsOsvFinding(item,{id:'GHSA-other'},locks),false);
  assert.equal(permitsOsvFinding({...item,version:'4.0.8'},{id:advisoryId},locks),false);
  assert.equal(permitsOsvFinding({...item,package:{name:'vite'}},{id:advisoryId},locks),false);
});
test('the browser bundle rejects build/test modules, including nested Windows paths',()=>{
  assert.doesNotThrow(()=>assertRuntimeModuleBoundary(['/app/node_modules/react/index.js','/app/src/App.jsx']));
  for(const name of ['picomatch','vite','vitest'])assert.throws(()=>assertRuntimeModuleBoundary([`C:\\app\\node_modules\\nested\\node_modules\\${name}\\index.js`]),/exception is invalid/);
});
