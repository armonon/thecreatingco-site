import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMetadata, validateUploadRequest } from '../netlify/functions/collection-files.mjs';
import { CollectionError } from '../netlify/lib/collections-guard.mjs';

const valid = { collectionId:'11111111-1111-4111-8111-111111111111', bytes:4096, mime:'application/pdf', pageCount:3, thumbnailData:'data:image/jpeg;base64,SGVsbG8=', title:'Sample book', author:'A Reader', tags:['history'], shareRights:true };

test('upload admission rejects spoofed MIME, invalid sizes, and malformed identity', () => {
  assert.deepEqual(validateUploadRequest(valid), { title:'Sample book', author:'A Reader', description:'', tags:['history'] });
  for (const changes of [
    {mime:'text/html'}, {mime:'application/octet-stream'}, {bytes:0}, {bytes:52*1024*1024},
    {collectionId:'../alice'}, {pageCount:0}, {thumbnailData:'data:text/html;base64,PHNjcmlwdD4='}, {shareRights:false},
    {tags:Array.from({length:21},(_,i)=>`tag-${i}`)}, {title:' '.repeat(241)},
  ]) assert.throws(() => validateUploadRequest({...valid,...changes}), CollectionError);
});

test('metadata extraction output is bounded before it can enter stored collection records', () => {
  assert.equal(validateMetadata(valid).title,'Sample book');
  assert.throws(() => validateMetadata({...valid, thumbnailData:'x'.repeat(40001)}), {status:400});
  assert.throws(() => validateMetadata({...valid, description:'x'.repeat(2001)}), {status:400});
});
