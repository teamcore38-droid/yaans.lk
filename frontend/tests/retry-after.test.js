import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retryAfterSeconds, apiFailure } from '../src/utils/retryAfter.js';

test('Retry-After accepts seconds and HTTP dates with safe timer bounds',()=>{
  const now=Date.parse('2026-11-21T06:00:00Z');
  assert.equal(retryAfterSeconds('120',now),120);
  assert.equal(retryAfterSeconds('Sat, 21 Nov 2026 06:02:00 GMT',now),120);
  assert.equal(retryAfterSeconds('0',now),1);
  assert.equal(retryAfterSeconds('999999999',now),86400);
  for(const value of [undefined,null,'','invalid','-1','1.5'])assert.equal(retryAfterSeconds(value,now),null);
});
test('rate limit errors expose a safe wait duration even when the response is HTML',()=>{
  const failure=apiFailure({status:429,headers:{get:()=> '90'}});
  assert.equal(failure.status,429);assert.equal(failure.retryAfter,90);assert.equal(failure.code,'RATE_LIMITED');assert.match(failure.message,/90 seconds/);
  assert.equal(apiFailure({status:429},{}).retryAfter,30);
  assert.equal(apiFailure({status:401},{message:'Sign in again.'}).message,'Sign in again.');
});
