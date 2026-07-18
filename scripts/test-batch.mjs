import assert from 'node:assert/strict';
import {parseCsv} from './batch/csv.mjs';
import {validateInput,isDirectDestination,HEADERS} from './batch/policy.mjs';

assert.deepEqual(parseCsv('a,b\n"x,y","he said ""yes"""\n'),[['a','b'],['x,y','he said "yes"']]);
assert.equal(isDirectDestination('spotify','https://open.spotify.com/artist/abc123'),true);
assert.equal(isDirectDestination('spotify','https://open.spotify.com/search/Artist/artists'),false);
assert.equal(isDirectDestination('youtube','https://www.youtube.com/results?search_query=artist'),false);
assert.equal(isDirectDestination('featuredVideo','https://www.youtube.com/watch?v=abc123'),true);
const base=Object.fromEntries(Object.values(HEADERS).map(key=>[key,'https://example.com/value']));
Object.assign(base,{'Artist Name':'Test Artist','Location':'Melbourne','Genre':'Rock','Follower Count (approx.)':'2,001','Follower Platform':'Instagram'});
const valid=validateInput([{rowNumber:2,...base}])[0];assert.equal(valid.inputErrors.length,0);
const duplicate=validateInput([{rowNumber:2,...base},{rowNumber:3,...base}]);assert.equal(duplicate[1].inputErrors.some(item=>item.code==='DUPLICATE_ARTIST'),true);
const outOfRange=validateInput([{rowNumber:2,...base,'Follower Count (approx.)':'50,001'}])[0];assert.equal(outOfRange.inputErrors.some(item=>item.code==='FOLLOWER_RANGE_FAILED'),true);
console.log('Deep Cuts batch unit tests passed.');
