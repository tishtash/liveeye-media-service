"use strict";
const fs = require("fs");

module.exports = class HlsVideo {
  constructor() {}

  serveHLSVideo = (req, res) => {
    const filePath = `./videos/stream/${req.params.id}/${req.params.file}`;

    try {
      fs.stat(filePath, function(err, stats) {
        if (!stats || err) {
          return res.status(404).end();
        } else {
          var fileExt = filePath.slice(filePath.lastIndexOf("."));
          fileExt = (fileExt && fileExt.toLowerCase()) || fileExt;

          switch (fileExt) {
            case ".m3u8":
              res
                .status(200)
                .set("Content-Type", "application/vnd.apple.mpegurl");
              fs.createReadStream(filePath).pipe(res);
              break;
            case ".ts":
              res.status(200).set("Content-Type", "video/MP2T");
              fs.createReadStream(filePath).pipe(res);
              break;
            case ".mjpeg":
              res.status(200).set("Content-Type", "multipart/x-mixed-replace");
              fs.createReadStream(filePath).pipe(res);
              break;
            default:
              res.status(400).send("Unexpected file type " + fileExt);
          }
        }
      });
    } catch (err) {
      res.status(400).send({ message: "Process doesn't exist" });
    }
  };
};
