import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cookieNames, setSessionCookies, assertCsrf, readCookies } from '../src/config/sessionCookies.js';
import { isSafeInternalLink, safeInternalLink } from '../../shared/safeLinks.js';

test('deployed sessions use host-only secure HttpOnly cookies and a short administrator lifetime',()=>{
  const previous=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
  try {
    const cookies=[];const res={cookie:(name,value,options)=>cookies.push({name,value,options}),set:()=>{}};
    setSessionCookies(res,'synthetic-session','synthetic-csrf',true);
    assert.deepEqual(cookieNames(),{session:'__Host-yaans_session',csrf:'__Host-yaans_csrf'});
    assert.equal(cookies[0].options.httpOnly,true);assert.equal(cookies[1].options.httpOnly,false);
    for(const {options}of cookies){assert.equal(options.secure,true);assert.equal(options.path,'/');assert.equal(options.domain,undefined);assert.equal(options.sameSite,'lax');assert.equal(options.maxAge,3600000);}
  } finally {if(previous===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=previous;}
});

test('mutations require the session-bound CSRF value and reject ambiguous cookie input',()=>{
  assert.doesNotThrow(()=>assertCsrf({method:'GET',headers:{}},{csrf:'synthetic-a'}));
  assert.doesNotThrow(()=>assertCsrf({method:'POST',headers:{'x-csrf-token':'synthetic-a'}},{csrf:'synthetic-a'}));
  for(const token of [undefined,'synthetic-b',['synthetic-a']])assert.throws(()=>assertCsrf({method:'POST',headers:{'x-csrf-token':token}},{csrf:'synthetic-a'}),{status:403});
  assert.throws(()=>readCookies({headers:{cookie:'yaans_session=one; yaans_session=two'}}),{status:401});
  assert.throws(()=>readCookies({headers:{cookie:'yaans_session=%invalid'}}),{status:400});
});

test('legacy banner links cannot become executable or external navigation',()=>{
  for(const link of ['javascript:alert(1)','data:text/html,test','//example.invalid','/\\example.invalid','/%2fexample.invalid','/%5cexample.invalid','/products%0a',null,{},'/products\n']){
    assert.equal(isSafeInternalLink(link),false);assert.equal(safeInternalLink(link),'/products');
  }
  for(const link of ['/','/products?category=home&sort=price','/store/example#products'])assert.equal(safeInternalLink(link),link);
});
