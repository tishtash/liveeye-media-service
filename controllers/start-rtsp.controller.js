"use strict";
const fs = require("fs");
const FfmpegRtspCommand = require("fluent-ffmpeg");
const promiseRetry = require("promise-retry");

module.exports = class RTSPStream {
  constructor(logger) {
    this.log = logger;
  }

  setupMjpegDirectory = async dir => {
    this.log.debug("MJPEGStream:: Setting up directory");
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(dir)) {
        this.log.debug("MJPEGStream:: Directory doesn't exist.");
        this.log.debug("MJPEGStream:: Creating directory now.");
        fs.mkdir(dir, { recursive: true }, err => {
          if (err) {
            this.log.error("MJPEGStream:: Failed to create directory. -", err);
            reject(err);
          }
          this.log.debug("MJPEGStream:: Directory created succssfully.");
          resolve("Success");
        });
      }
    });
  };

  setupDirectory = async dir => {
    this.log.debug("RTSPStream:: Setting up directory");
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(dir)) {
        this.log.debug("RTSPStream:: Directory doesn't exist.");
        this.log.debug("RTSPStream:: Creating directory now.");
        fs.mkdir(dir, { recursive: true }, err => {
          if (err) {
            this.log.error("RTSPStream:: Failed to create directory.");
            reject({ message: err });
          }
          this.log.debug("RTSPStream:: Directory created succssfully.");
          resolve("Success");
        });
      }
    });
  };

  // ./ffmpeg -listen 1 -i rtmp://martin-riedl.de/stream01 \
  //   -filter_complex "[v:0]split=2[vtemp001][vout002];[vtemp001]scale=w=960:h=540[vout001]" \
  //   -preset veryfast -g 25 -sc_threshold 0 \
  //   -map [vout001] -c:v:0 libx264 -b:v:0 2000k -maxrate:v:0 2200k -bufsize:v:0 3000k \
  //   -map [vout002] -c:v:1 libx264 -b:v:1 6000k -maxrate:v:1 6600k -bufsize:v:1 8000k \
  //   -map a:0 -map a:0 -c:a aac -b:a 128k -ac 2 \
  //   -f hls -hls_time 4 -hls_playlist_type event -hls_flags independent_segments \
  //   -master_pl_name master.m3u8 \
  //   -hls_segment_filename stream_%v/data%06d.ts \
  //   -use_localtime_mkdir 1 \
  //   -var_stream_map "v:0,a:0 v:1,a:1" stream_%v.m3u8
  // rtsp://50.193.194.17:554/cam1_stream1
  // rtsp://admin:Liv5901@50.193.194.18:8554/CH001.sdp
  // rtsp://admin:35201spanaway@67.168.47.128:8554/Streaming/Unicast/channels/501

  // -max_muxing_queue_size 1024
  startStream = async (
    rtspUrl,
    streamId,
    outputPath,
    db,
    shouldSetupDirectory
  ) => {
    let log = this.log;
    let uri = `${outputPath}/index.m3u8`;
    let fps = 25;
    return new Promise(async (resolve, reject) => {
      try {
        fps = (await this.getFrameRate(rtspUrl)) || 25;
        console.log(fps);
        if (shouldSetupDirectory) {
          await this.setupDirectory(outputPath);
          await this.setupMjpegDirectory(`${outputPath}/mjpeg`);
        }
        this.startStreamProcess(
          rtspUrl,
          streamId,
          uri,
          outputPath,
          fps,
          this.log,
          db
        );
        resolve({ message: "Streaming process is queued..." });
      } catch (err) {
        log.error(err);
        reject({ message: err });
      }
    });
  };

  startStreamProcess = (rtspUrl, streamId, uri, outputPath, fps, log, db) => {
    let isResolved = false;
    var streamProcess = new FfmpegRtspCommand(rtspUrl);
    const retryProcess = this.retryProcess;
    let timeoutRef;
    streamProcess
      .inputOptions([
        "-y",
        "-fflags nobuffer",
        "-analyzeduration 150000000",
        "-probesize 150000000",
        "-re",
        // "-fpsprobesize 150000000",
        "-rtsp_transport tcp"
      ])
      .output(`${outputPath}/mjpeg/stream.jpg`)
      .outputOptions([
        "-preset veryfast",
        "-ignore_unknown",
        "-an",
        "-r 1",
        "-s 300x300",
        "-f image2",
        "-update 1"
      ])

      .output(`${outputPath}/index.m3u8`)
      .outputOptions([
        "-preset veryfast",
        // `-g ${fps}`,
        "-sc_threshold 0",
        // "-an",
        // "-dump",
        "-ignore_unknown",
        // "-max_interleave_delta 1000000000",
        "-max_muxing_queue_size 9999",
        // "-an",
        // "-c copy",
        // "-map v:0",
        // "-c:v:0 yuvj420p",
        // "-vf scale=1920:1080:force_original_aspect_ratio=decrease",
        // -map v:0 -c:v:0 libx264 -b:v:0 2000k \
        // -map v:0 -c:v:1 libx264 -b:v:1 6000k \
        // "-vsync 0",
        "-copyts",
        // "-vcodec copy",
        // "-an",
        // "-max_muxing_queue_size 99999",
        "-movflags frag_keyframe+empty_moov",
        // "-c:v copy",
        // "-map v:0",
        // "-c:v copy",
        // "-map a:0",
        // "-c:a:0 pcm_mulaw",
        // "-b:a 64k",
        // "-ac 2",
        // "-acodec copy",
        "-f hls",
        "-hls_flags delete_segments+append_list",
        "-segment_list_flags live",
        "-segment_list_type m3u8",
        "-hls_time 4",
        "-hls_list_size 150",
        `-hls_segment_filename ${outputPath}/file_%03d.ts`
      ])

      .on("start", function(commandLine) {
        db.get("list")
          .find({ id: streamId })
          .assign({ processId: streamProcess.ffmpegProc.pid })
          .write();
        timeoutRef = setTimeout(() => {
          if (!isResolved) {
            process.kill(streamProcess.ffmpegProc.pid, "SIGKILL");
          }
        }, 300000);
        log.debug(
          `RTSPStream::Spawned Ffmpeg on process id ${streamProcess.ffmpegProc.pid} with command: " + ${commandLine}`
        );
      })
      .on("progress", function(progress) {
        if (!isResolved && fs.existsSync(`${uri}`)) {
          log.info("RTSP stream started successfully");
          clearTimeout(timeoutRef);
          db.get("list")
            .find({ id: streamId })
            .assign({ running: true })
            .write();
          isResolved = true;
          // setTimeout(() => {
          //   console.log("Stopping the process");
          //   process.kill(streamProcess.ffmpegProc.pid, 'SIGSTOP')
          // }, 2000);

          // setTimeout(() => {
          //   console.log("Starting the process");
          //   process.kill(streamProcess.ffmpegProc.pid, 'SIGSTOP')
          // }, 15000);
        }
      })
      .on("end", function(err, stdout, stderr) {
        log.debug("RTSPStream::END::Error::", err);
        log.debug("RTSPStream::END::Stdout::", stdout);
        log.debug("RTSPStream::END::Stderr::", stderr);
        log.debug("RTSPStream::END::End Received");
        db.get("list")
          .find({ id: streamId })
          .assign({ running: false })
          .write();
        retryProcess(rtspUrl, streamId, outputPath, db, false);
      })
      .on("error", function(err, stdout, stderr) {
        log.error("Process has been killed");
        log.debug("RTSPStream::ERROR::Error::", err);
        log.debug("RTSPStream::ERROR::Stdout::", stdout);
        log.debug("RTSPStream::ERROR::Stderr::", stderr);
        console.log(err.toString());
        if (!err.toString().includes("SIGKILL")) {
          db.get("list")
            .find({ id: streamId })
            .assign({ running: false })
            .write();
          retryProcess(rtspUrl, streamId, outputPath, db, false);
        }
      })
      .run();
  };

  getFrameRate = rtspUrl => {
    const ffProbePromise = new Promise((resolve, reject) => {
      let ffprobeProcess = FfmpegRtspCommand(rtspUrl).ffprobe(
        (err, metadata) => {
          if (err || !metadata) {
            if (err.message.toLowerCase().includes("connection refused")) {
              reject({
                message: `Connection to ${rtspUrl} is refused by the network. Please ensure the IP is correct and the port is open`
              });
            } else {
              reject(err.message);
            }
          }
          if (metadata) {
            this.log.debug(metadata);
            const frameRateArr = metadata.streams[0].avg_frame_rate.split("/");
            resolve((frameRateArr[0] / frameRateArr[1]).toFixed());
          }
        }
      );
    });

    return Promise.race([this.timeOutPromise(100000), ffProbePromise]);
  };

  timeOutPromise = ms => {
    return new Promise((resolve, reject) => {
      let timeoutId = setTimeout(() => {
        reject({
          message: `Please ensure the IP and ports are reachable. Request Timed out in ${ms /
            1000} second/s.`
        });
        clearTimeout(timeoutId);
      }, ms);
    });
  };

  retryProcess = (rtspUrl, streamId, outputPath, db, shouldCreateDirectory) => {
    promiseRetry(
      async (retry, number) => {
        this.log.debug(`Attempt number ${number}`);
        return this.startStream(
          rtspUrl,
          streamId,
          outputPath,
          db,
          shouldCreateDirectory
        ).catch(retry);
      },
      { retries: 20, minTimeout: 60000 }
    ).then(
      val => {
        this.log.debug(val);
      },
      err => {
        this.log.error(err);
      }
    );
  };
};
