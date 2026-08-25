const fs = require('fs');
const { ZipArchive } = require('archiver');
const path = require('path');

const output = fs.createWriteStream(path.join(__dirname, 'public/downloads/seo-autopilot-connector.zip'));
const archive = new ZipArchive({
  zlib: { level: 9 }
});

output.on('close', function() {
  console.log(archive.pointer() + ' total bytes');
});
archive.on('error', function(err) { throw err; });
archive.pipe(output);
archive.directory(path.join(__dirname, 'wordpress-plugin/seo-autopilot-connector/'), 'seo-autopilot-connector');
archive.finalize();
