import { test } from "node:test";
import { strict as assert } from "node:assert";
// The extension uses an independent browser boundary; the server repeats validation.
test("extension pre-storage sanitizer drops secrets and browser mechanics",async()=>{
  // @ts-expect-error Plain extension module is separately syntax-checked.
  const {sanitize,validEndpoint}=await import("../../extension/privacy.mjs");
  const result=sanitize({subject:"Support issue",password:"secret",body:"copied",coordinates:{x:2},url:"https://mail.google.com/mail/u/0?secret=1#mail",owner:"token=private"});
  assert.deepEqual(result,{subject:"Support issue",url:"https://mail.google.com/mail/u/0"});
  assert.equal(validEndpoint("http://localhost:3000"),true);assert.equal(validEndpoint("https://rehearsal.example"),true);assert.equal(validEndpoint("http://remote.example"),false);assert.equal(validEndpoint("https://host.example/?token=secret"),false);
});
