"use strict";
const fs = require("fs");

module.exports = class MjpegVideo {
  constructor() {}

  serveMjpegVideo = (req, res) => {
    const filePath = `./videos/stream/${req.params.id}/mjpeg/stream.jpeg`;
    const boundary = "Ba4oTvQMY8ew04N8dcnM"; // boundary string
    var fileExt = filePath.slice(filePath.lastIndexOf("."));
    fileExt = (fileExt && fileExt.toLowerCase()) || fileExt;
    if (fileExt === ".jpeg") {
      let imageInterval;
      res.setHeader(
        "Content-Type",
        "multipart/x-mixed-replace;boundary=" + boundary
      );
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Pragma", "no-cache");
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, pre-check=0, post-check=0, max-age=0"
      );
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Expires", -1);
      res.setHeader("Max-Age", 0);

      try {
        imageInterval = setInterval(() => {
          if (fs.existsSync(filePath)) {
            fs.readFile(filePath, (err, imageData) => {
              if (!err) {
                res.write("--" + boundary + "\r\n");
                res.write("Content-Type: image/jpeg\r\n");
                res.write("Content-Length: " + imageData.length + "\r\n");
                res.write("\r\n");
                res.write(Buffer.from(imageData), "binary");
                res.write("\r\n");
              } else {
                console.log(err);
              }
            });
          }
        }, 1000);
      } catch (err) {
        clearInterval(imageInterval);
        res.status(400).send({ message: "Process doesn't exist" });
      }
    } else {
      res.status(400).send("Unexpected file type " + fileExt);
    }
  };
};
