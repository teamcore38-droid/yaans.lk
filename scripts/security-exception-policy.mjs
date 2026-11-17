export const advisoryId='GHSA-fc5q-39xc-vjpf';
const versions=['2.3.2','4.0.7'];

export function validateException(policy,now=new Date()) {
  if(policy?.advisory!==advisoryId||policy.package!=='picomatch'||policy.directory!=='frontend'||policy.developmentOnly!==true||
    JSON.stringify(policy.versions)!==JSON.stringify(versions)||policy.reviewDate!=='2026-12-18'||
    policy.expiresAt!=='2026-12-18T00:00:00+05:30'||!policy.justification||!Number.isFinite(+now)||+now>=Date.parse(policy.expiresAt)){
    throw new Error('Security exception is invalid or expired; review is required.');
  }
}

export function developmentOnly(locks,name,version) {
  const occurrences=locks.flatMap(({directory,lock})=>Object.entries(lock.packages||{}).filter(([location,p])=>location&&
    (p.name||location.split('node_modules/').at(-1))===name&&p.version===version).map(([,p])=>({...p,directory})));
  return occurrences.length>0&&occurrences.every(p=>p.directory==='frontend'&&p.dev===true&&!p.link);
}

export function permitsOsvFinding(item,finding,locks) {
  return finding?.id===advisoryId&&item.package.name==='picomatch'&&versions.includes(item.version)&&developmentOnly(locks,'picomatch',item.version);
}

// npm represents transitive findings as graph edges. Every path must end at
// this exact advisory; cycles, missing edges and mixed advisories fail closed.
export function permitsNpmFinding(name,report,directory,lock,locks,visiting=new Set()) {
  const finding=report.vulnerabilities?.[name];
  if(directory!=='frontend'||!finding||visiting.has(name)||!Array.isArray(finding.nodes)||!finding.nodes.length||
    !finding.nodes.every(node=>lock.packages?.[node]?.dev===true)||!Array.isArray(finding.via)||!finding.via.length)return false;
  const next=new Set(visiting).add(name);
  return finding.via.every(via=>{
    if(typeof via==='string')return permitsNpmFinding(via,report,directory,lock,locks,next);
    if(!via||via.name!=='picomatch'||via.url!==`https://github.com/advisories/${advisoryId}`||name!=='picomatch')return false;
    return finding.nodes.every(node=>{
      const p=lock.packages[node];
      return versions.includes(p.version)&&developmentOnly(locks,'picomatch',p.version);
    });
  });
}
