var zip = require("bestzip");

zip({
  source: [
    "build/*",
    "controllers/*",
    "certs/*",
    "services/*",
    "index.js",
    ".env",
    "liveeye-media-service-setup.bat",
    "liveeye-media-service-stop.bat",
    "liveeye-media-service-start.bat",
    "package-lock.json",
    "package.json"
  ],
  destination: "./zip/liveeye-media-service.zip"
})
  .then(function() {
    console.log("File succesfully zipped");
  })
  .catch(function(err) {
    console.error(err.stack);
    process.exit(1);
  });
