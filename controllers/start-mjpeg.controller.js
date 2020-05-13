"use strict";
const { uuid } = require("uuidv4");
const fs = require("fs");
const FfmpegMjpegCommand = require("fluent-ffmpeg");
// const rtspPorcess = require("../services/rtsp-process.service");

module.exports = class MJPEGStream {
  constructor(uri, alias, id) {
    this.uri = uri;
    this.alias = alias || "static";
    this.id = id;
    this.dir = `./videos/stream/${this.id}/mjpeg`;
  }

  setupDirectory = async () => {
    console.log("MJPEGStream:: Setting up directory");
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(this.dir)) {
        console.log("MJPEGStream:: Directory doesn't exist.");
        console.log("MJPEGStream:: Creating directory now.");
        fs.mkdir(this.dir, { recursive: true }, err => {
          if (err) {
            console.log("MJPEGStream:: Failed to create directory. -", err);
            reject(err);
          }
          console.log("MJPEGStream:: Directory created succssfully.");
          resolve("Success");
        });
      }
    });
  };
  //-vf fps=fps=1/20 -update 1 img.jpg
  startStream = async () => {
    let uri = `/videos/stream/${this.id}/mjpeg/stream.mjpeg`;
    let id = this.id;
    let alias = "";
    let isResolved = false;
    return new Promise((resolve, reject) => {
      var mjpegProcess = FfmpegMjpegCommand(this.uri, {
        timeout: 432000
      })
        .inputOptions(["-rtsp_transport", "tcp"])
        .outputOptions(["-f image2", "-update 1"])
        .on("start", function(commandLine) {
          console.log(
            `MJPEGStream::Spawned Ffmpeg on process id ${process.pid} with command: " + ${commandLine}`
          );
        })
        .on("progress", function(progress) {
          if (!isResolved && fs.existsSync(`.${uri}`)) {
            resolve({ uri: uri, mjpegProcess: mjpegProcess });
            isResolved = true;
            // setTimeout(() => {
            //   console.log("Stopping the process");
            //   process.kill("SIGSTOP");
            // }, 2000);

            // setTimeout(() => {
            //   console.log("Starting the process");
            //   process.kill("SIGCONT");
            // }, 15000);
          }
        })
        .on("end", function(err, stdout, stderr) {
          console.log("MJPEGStream::END::Error::", err);
          console.log("MJPEGStream::END::Stdout::", stdout);
          console.log("MJPEGStream::END::Stderr::", stderr);
          console.log("MJPEGStream::END::End Received");
          reject(err);
        })
        .on("error", function(err, stdout, stderr) {
          console.log("MJPEGStream::ERROR::Error::", err);
          console.log("MJPEGStream::ERROR::Stdout::", stdout);
          console.log("MJPEGStream::ERROR::Stderr::", stderr);
          reject(err);
        })
        .save(`${this.dir}/stream.mjpeg`);

      mjpegProcess.on("error", () => {
        console.log("Process has been killed");
        reject(err);
      });
    });
  };
};
