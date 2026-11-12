import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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
  for(const directory of ['.','backend','frontend']){
    let output;
    try{output=execFileSync(process.execPath,[npm,'audit','--json'],{cwd:path.join(root,directory),encoding:'utf8',timeout:60000,stdio:['ignore','pipe','pipe']});}
    catch(error){output=error.stdout;if(!output)throw new Error(`Dependency audit could not run in ${directory}.`);}
    let result;try{result=JSON.parse(output);}catch{throw new Error(`Dependency audit returned invalid data for ${directory}.`);}
    if(result.error||!result.metadata?.vulnerabilities)throw new Error(`Dependency audit was unavailable for ${directory}.`);
    if(result.metadata.vulnerabilities.total>0)throw new Error(`Dependency advisories require review in ${directory}: ${Object.keys(result.vulnerabilities||{}).join(', ')}`);
  }
  const inventory=packageInventory(['package-lock.json','backend/package-lock.json','frontend/package-lock.json'].map(file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))));
  // A second feed catches prerelease-range gaps observed in npm audit.
  const response=await fetchImpl('https://api.osv.dev/v1/querybatch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({queries:inventory}),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('Independent advisory verification is unavailable.');
  const result=await response.json();
  if(!Array.isArray(result.results)||result.results.length!==inventory.length)throw new Error('Independent advisory verification returned incomplete data.');
  const affected=inventory.filter((_,index)=>result.results[index]?.vulns?.length);
  if(affected.length)throw new Error(`Independent advisories require review: ${affected.map(p=>`${p.package.name}@${p.version}`).join(', ')}`);
  console.log(`Dependency security checks passed for ${inventory.length} distinct locked package versions (npm and OSV).`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await verifyDependencies();}catch(error){console.error(error.message);process.exitCode=1;}
}
