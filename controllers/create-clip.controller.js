"use strict";
const fs = require("fs");
var rp = require("request-promise");
const FfmpegRtspCommand = require("fluent-ffmpeg");
const config = require("dotenv").config().parsed;

module.exports = class PushButtonClipService {
  constructor(logger, trigger_id, vmsHost, env) {
    this.log = logger;
    this.trigger_id = trigger_id;
    this.vmsHost = vmsHost;
    this.env = env;
  }

  setupClipDirectory = async dir => {
    this.log.debug("PushButtonClipService:: Setting up directory");
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(dir)) {
        this.log.debug("PushButtonClipService:: Directory doesn't exist.");
        this.log.debug("PushButtonClipService:: Creating directory now.");
        fs.mkdir(dir, { recursive: true }, err => {
          if (err) {
            this.log.error(
              "PushButtonClipService:: Failed to create directory."
            );
            reject({ message: err });
          }
          this.log.debug(
            "PushButtonClipService:: Directory created succssfully."
          );
          resolve("Success");
        });
      } else {
        this.log.debug("PushButtonClipService:: Directory already exist.");
        resolve("Success");
      }
    });
  };

  createClip = (rtspUrl, outputPath) => {
    let log = this.log;
    const streamProcess = new FfmpegRtspCommand(rtspUrl);
    streamProcess
      .inputOptions([
        "-loglevel warning",
        "-use_wallclock_as_timestamps 1",
        `-t ${config.PUSHBUTTON_CLIP_INTERVAL}`,
        "-rtsp_transport tcp"
      ])
      .output(`${outputPath}/%Y-%m-%dT%H-%M-%S.mp4`)
      .outputOptions([
        "-map 0",
        "-f segment",
        "-segment_format mp4",
        "-reset_timestamps 1",
        "-strftime 1",
        `-segment_time ${config.PUSHBUTTON_CLIP_INTERVAL}`,
        "-segment_list pipe:1",
        "-strict 2"
      ])
      .on("start", commandLine => {
        log.debug(
          `RTSPStream::Spawned Ffmpeg on process id ${streamProcess.ffmpegProc.pid} with command: " + ${commandLine}`
        );
      })
      .on("end", async (stdout, stderr) => {
        try {
          const url = `${this.vmsHost}${outputPath.replace(
            ".",
            ""
          )}/${stdout.trim()}`;
          const token = await this.getAuthToken();
          await this.addVideoLink(token, url);
          log.debug("RTSPStream::END::Stdout::", stdout);
          log.debug("RTSPStream::END::Stderr::", stderr);
          log.debug("RTSPStream::END::End Received");
        } catch (err) {
          log.error(err.message);
        }
        streamProcess.kill("SIGKILL");
      })
      .on("error", (err, stdout, stderr) => {
        log.error("Process has been killed");
        log.debug("RTSPStream::ERROR::Error::", err);
        log.debug("RTSPStream::ERROR::Stdout::", stdout);
        log.debug("RTSPStream::ERROR::Stderr::", stderr);
      })
      .run();
  };

  getAuthToken = async () => {
    let apiUrl = `${config.PROD_ENV_HOST}/api/login/employee`;
    if (this.env && this.env.toLowerCase().includes("dev")) {
      apiUrl = `${config.DEV_ENV_HOST}/api/login/employee`;
    }
    console.log(apiUrl);
    try {
      this.log.debug("getAuthToken::", "Initiating call to retrieve token");
      const options = {
        method: "POST",
        url: apiUrl,
        body: {
          username: config.API_USER,
          password: config.API_PWD
        },
        json: true
      };
      const response = await rp(options);
      this.log.debug("getAuthToken::", "Received token succesfully");
      return response.token;
    } catch (err) {
      this.log.error("getAuthToken::", err.message);
    }
  };

  addVideoLink = async (token, url) => {
    let apiUrl = `${config.PROD_ENV_HOST}/api/push-button/alert/videolink`;
    if (this.env && this.env.toLowerCase().includes("dev")) {
      apiUrl = `${config.DEV_ENV_HOST}/api/push-button/alert/videolink`;
    }
    console.log(apiUrl);
    try {
      this.log.debug(
        "addVideoLink::",
        "Initiating call to add video link to the DB"
      );
      const options = {
        method: "PUT",
        url: apiUrl,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: {
          trigger_id: this.trigger_id,
          video_link: url
        },
        json: true
      };
      await rp(options);
      this.log.debug("addVideoLink::", "Added video link succesfully");
    } catch (err) {
      this.log.error("addVideoLink::", err.message);
    }
  };
};
