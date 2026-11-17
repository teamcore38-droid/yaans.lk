import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import {validateException,permitsNpmFinding,permitsOsvFinding,developmentOnly} from './security-exception-policy.mjs';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
export function packageInventory(lockfiles) {
  const packages=new Map();
  for(const lock of lockfiles)for(const [location,item]of Object.entries(lock.packages||{})){
    if(!location||!item.version||item.link)continue;
    const name=item.name||location.split('node_modules/').at(-1);
    if(!name||!/^(@[\w.-]+\/)?[\w.-]+$/.test(name))throw new Error('Unsupported package identity in lockfile');
    packages.set(`${name}@${item.version}`,{package:{name,ecosystem:'npm'},version:item.version});
  }
  return [...packages.values()];
}
export async function verifyDependencies({fetchImpl=fetch}={}) {
  const npm=process.env.npm_execpath;
  if(!npm||!npm.endsWith('npm-cli.js'))throw new Error('Run this check through npm run test:security.');
  const policy=JSON.parse(fs.readFileSync(path.join(root,'config/security-exceptions.json'),'utf8'));
  validateException(policy);
  const locks=['.','backend','frontend'].map(directory=>({directory,lock:JSON.parse(fs.readFileSync(path.join(root,directory,'package-lock.json'),'utf8'))}));
  // A change in production reachability invalidates this acceptance, regardless
  // of whether one advisory feed temporarily omits a finding.
  for(const {lock} of locks)for(const [location,p] of Object.entries(lock.packages||{})){
    if(location&&(p.name||location.split('node_modules/').at(-1))==='picomatch'&&!developmentOnly(locks,'picomatch',p.version))throw new Error('picomatch is no longer exclusively frontend development tooling.');
  }
  const reportDirectory=path.join(root,'test-results/security');fs.mkdirSync(reportDirectory,{recursive:true});
  const failures=[];let accepted=0;
  for(const {directory,lock} of locks)for(const production of [true,false]){
    const label=`${directory==='.'?'root':directory}-${production?'production':'full'}`;
    const args=['audit',...(production?['--omit=dev','--audit-level=high']:[]),'--json'];
    let output;
    try{output=execFileSync(process.execPath,[npm,...args],{cwd:path.join(root,directory),encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});}
    catch(error){output=error.stdout;if(!output||error.status!==1||error.signal)throw new Error(`Dependency audit could not run in ${directory}.`);}
    let result;try{result=JSON.parse(output);}catch{throw new Error(`Dependency audit returned invalid data for ${directory}.`);}
    fs.writeFileSync(path.join(reportDirectory,`${label}.json`),JSON.stringify(result,null,2));
    console.log(`[security] ${label}: ${JSON.stringify(result)}`);
    if(result.error||!Number.isInteger(result.metadata?.vulnerabilities?.total)||!result.vulnerabilities||
      result.metadata.vulnerabilities.total!==Object.keys(result.vulnerabilities).length)throw new Error(`Dependency audit was unavailable or incomplete for ${directory}.`);
    for(const name of Object.keys(result.vulnerabilities)){
      if(!production&&permitsNpmFinding(name,result,directory,lock,locks))accepted++;
      else failures.push(`${label}: ${name}`);
    }
  }
  const inventory=packageInventory(['package-lock.json','backend/package-lock.json','frontend/package-lock.json'].map(file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))));
  // A second feed catches prerelease-range gaps observed in npm audit.
  const response=await fetchImpl('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({queries:inventory}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('Independent advisory verification is unavailable.');
  const result=await response.json();
  fs.writeFileSync(path.join(reportDirectory,'osv-full.json'),JSON.stringify({inventory,...result},null,2));
  if(!Array.isArray(result.results)||result.results.length!==inventory.length)throw new Error('Independent advisory verification returned incomplete data.');
  for(const [index,item] of inventory.entries()){
    const entry=result.results[index];
    if(!entry||typeof entry!=='object'||(entry.vulns!==undefined&&!Array.isArray(entry.vulns)))throw new Error('Independent advisory verification returned malformed data.');
    for(const finding of entry.vulns||[]){
      console.log(`[security] OSV ${item.package.name}@${item.version}: ${JSON.stringify(finding)}`);
      if(permitsOsvFinding(item,finding,locks))accepted++;
      else failures.push(`OSV: ${item.package.name}@${item.version}: ${finding?.id||'unknown'}`);
    }
  }
  if(failures.length)throw new Error(`Unapproved dependency advisories: ${failures.join(', ')}`);
  console.warn(`[security] TEMPORARY ACCEPTANCE: ${policy.advisory}, development-only picomatch ${policy.versions.join('/')}; ${accepted} npm graph/OSV entries; review ${policy.reviewDate}; expires ${policy.expiresAt}. Full reports: test-results/security/.`);
  console.log(`Dependency security policy passed for ${inventory.length} distinct locked package versions; production audits and both feeds checked.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await verifyDependencies();}catch(error){console.error(error.message);process.exitCode=1;}
}
