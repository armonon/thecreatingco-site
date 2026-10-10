import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const compiled = await build({entryPoints:[new URL('../app/project-document.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
const {offlineMediaAssets,projectDocument}=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
import {buildMediaRelinkMap} from '../lib/media-link.ts';
import {readProjectSettings} from '../lib/project-settings.ts';
import {DEFAULT_EFFECTS,parseCutFile} from '../lib/project-store.ts';

test('offline save and reopen retain source path and authored media metadata',()=>{
 const source={id:'missing-video',name:'clip.mp4',kind:'video',size:12345,lastModified:1000,sourcePath:'/Volumes/Media/clip.mp4',folderId:'custom-bin',favorite:true,beatMap:{version:1,bpm:120,confidence:1,beats:[0,.5,1],downbeats:[0],beatsPerBar:4}};
 const unresolved=buildMediaRelinkMap([source],[]).unresolved;
 const placeholder=offlineMediaAssets(unresolved,[]);
 assert.equal(placeholder.length,1);assert.equal(placeholder[0].offline,true);assert.equal(placeholder[0].url,'');
 const disk=projectDocument({snapshot:{duration:3,bpm:120,beatOffset:0,beats:[],sections:[],clipTracks:[],videoClips:[{id:'clip',assetId:source.id,start:0,duration:3,sourceStart:0}],baseCuts:[],titles:[],placements:[],compositions:[]},analysis:null,mainFile:null,mainName:'Offline project',mainSourcePath:'',assets:placeholder,effects:DEFAULT_EFFECTS,settings:readProjectSettings({})});
 const reopened=parseCutFile(JSON.stringify(disk));assert.deepEqual(reopened.assets[0],source);assert.equal(reopened.videoClips[0].assetId,source.id);
 assert.equal(buildMediaRelinkMap(reopened.assets,[source]).unresolved.length,0);
});
test('offline legacy media uses default bins and does not duplicate available identities',()=>{
 const sources=[{id:'a',name:'song.wav',kind:'audio'},{id:'b',name:'still.png',kind:'image'}];
 const placeholders=offlineMediaAssets(sources,[]);assert.equal(placeholders[0].folderId,'bin-audio');assert.equal(placeholders[1].folderId,'bin-graphics');
 assert.deepEqual(offlineMediaAssets(sources,placeholders),[]);
});
