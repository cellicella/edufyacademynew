// Used as the "build" step when uploading the prebuilt backend package (e.g. Hostinger Node.js web app):
// nothing is compiled on the server; this only confirms the prebuilt files are present.
import fs from 'node:fs';

if (!fs.existsSync('server-dist/server.mjs')) {
  console.error('server-dist/server.mjs is missing. Run "npm run build" on your PC and upload the package again.');
  process.exit(1);
}
console.log(`Prebuilt server found${fs.existsSync('dist/index.html') ? ' + website (dist/)' : ' (API only)'}.`);
