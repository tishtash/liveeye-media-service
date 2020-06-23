const express = require("express");
const cors = require("cors");
const https = require("https");
const http = require("http");
const certs = require("./certs/wildcarddomain.json");
const key = certs.key.privateKeyPem;
const cert = certs.cert;
const bodyParser = require("body-parser");
const serveHLSVideo = require("./controllers/serve-hls.controller");
const serveMjpegVideo = require("./controllers/serve-mjpeg.controller");
const RTSPStream = require("./controllers/start-rtsp.controller");
const PushButtonClipService = require("./controllers/create-clip.controller");
const rimraf = require("rimraf");
const { uuid } = require("uuidv4");
const app = express();
const log = require("lambda-log");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const config = require("dotenv").config().parsed;

process.argv.slice(2).forEach((val, index) => {
  if (val.toLowerCase().includes("cleandb")) {
    process.env["CLEANDB"] = true;
  }

  if (val.toLowerCase().includes("debug")) {
    process.env["DEBUG"] = true;
  }
});

log.options.debug = process.env.DEBUG === "true" ? true : false;
log.info("Starting up the application");
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

// Serve MP4 files
app.use("/clips", express.static("clips"));

const adapter = new FileSync("db.json");
const db = low(adapter);
const cleanUpFolders = () => {
  log.info("CLEANUP: Deleting stream folder");
  rimraf("./videos/stream", function() {
    log.info("CLEANUP: Succssfully Deleted stream folder");
  });
};

if (process.env.CLEANDB === "true") {
  cleanUpFolders();
  log.info("Cleaning up existing database");
  db.set("list", []).write();
}
log.info("Setting up database");

app.get("/list", (req, res) => {
  const list = db.get("list").value();
  let clientList = list.map(obj => {
    const tempObj = { ...obj };
    delete tempObj.proc;
    return tempObj;
  });
  return res.send(clientList);
});

app.get("/videos/stream/:id/:file", (req, res) => {
  try {
    const hlsVideo = new serveHLSVideo();
    hlsVideo.serveHLSVideo(req, res);
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.get("/videos/stream/:id/mjpeg/:file", (req, res) => {
  try {
    const serveMjpeg = new serveMjpegVideo();
    serveMjpeg.serveMjpegVideo(req, res);
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/start", async (req, res) => {
  try {
    let rtspUrl = new URL(req.body.rtspUrl);
    if (!rtspUrl.href.includes("127.0.0.1")) {
      return res.status(400).send({
        message: "An Error Occured",
        error: `Please ensure the rtsp url ip is set to 127.0.0.1`
      });
    }
  } catch (e) {
    return res.status(400).send({
      message: "An Error Occured",
      error: `Invalid URL::${req.body.rtspUrl}`
    });
  }
  try {
    const uniqueId = uuid();
    let resObj = {
      id: uniqueId,
      rtspUrl: req.body.rtspUrl,
      running: false,
      uri: `/videos/stream/${uniqueId}/index.m3u8`,
      cameraName: req.body.cameraName || "Aisle",
      mjpeg: `/videos/stream/${uniqueId}/mjpeg/stream.mjpeg`
    };
    // Start Check Existence
    const processExist = db
      .get("list")
      .find({ rtspUrl: req.body.rtspUrl })
      .value();
    if (processExist) {
      return res
        .status(400)
        .send({ message: `Stream already running ${req.body.rtspUrl}` });
    }
    // End Check Existence

    //Start new process
    const rtspStream = new RTSPStream(log);
    await rtspStream.startStream(
      req.body.rtspUrl,
      resObj.id,
      `./videos/stream/${resObj.id}`,
      db,
      true,
      { ...resObj }
    );
    return res.send([resObj]);
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/stop", (req, res) => {
  try {
    // process.kill(req.body.processId, "SIGSTOP");
    const proc = db
      .get("list")
      .find({ id: req.body.id })
      .value();

    if (!proc) {
      return res.status(400).send({
        message: `Unable to locate sream process with id ${req.body.id}`
      });
    }

    //stop process
    proc.proc.kill("SIGSTOP");
    db.get("list")
      .find({ id: req.body.id })
      .assign({ running: false })
      .write();
    return res.send({ message: "Stream process has been succesfully stopped" });
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/restart", (req, res) => {
  try {
    // process.kill(req.body.processId, "SIGCONT");
    const proc = db
      .get("list")
      .find({ id: req.body.id })
      .value();

    if (!proc) {
      return res.status(400).send({
        message: `Unable to locate sream process with id ${req.body.id}`
      });
    }

    //stop process
    proc.proc.kill("SIGCONT");
    db.get("list")
      .find({ id: req.body.id })
      .assign({ running: true })
      .write();
    return res.send({
      message: "Stream process has been succesfully re-started"
    });
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.put("/update/pushbutton", (req, res) => {
  try {
    const stream = db
      .get("list")
      .find({ id: req.body.id })
      .value();

    if (!stream) {
      return res.status(400).send({
        message: `Unable to locate sream process with id ${req.body.id}`
      });
    }

    db.get("list")
      .find({ id: req.body.id })
      .assign({ createPushButtonClip: req.body.createPushButtonClip || false })
      .write();
    return res.send({
      message: "Stream process has been updated with the given settings."
    });
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/remove", (req, res) => {
  try {
    // process.kill(req.body.processId, "SIGKILL");
    const proc = db
      .get("list")
      .find({ id: req.body.id })
      .value();

    if (!proc) {
      return res.status(400).send({
        message: `Unable to locate sream process with id ${req.body.id}`
      });
    }

    //stop process
    proc.proc.kill("SIGKILL");
    const processObj = db
      .get("list")
      .find({ id: req.body.id })
      .value();
    db.get("list")
      .remove({ id: req.body.id })
      .write();

    log.info(`CLEANUP: Deleting stream folder ${processObj.id}`);
    rimraf(`./videos/stream/${processObj.id}`, function() {
      log.info(`CLEANUP: Succssfully Deleted stream folder ${processObj.id}`);
    });
    return res.send({ message: "Stream process has been succesfully removed" });
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/clip/pushbutton", async (req, res) => {
  try {
    const streamClipsArr = db
      .get("list")
      .filter({ createPushButtonClip: true })
      .value();
    const clipService = new PushButtonClipService(
      log,
      req.body.trigger_id,
      req.body.vmsHost,
      req.body.env
    );
    if (streamClipsArr.length > 0) {
      // for (let i = 0; i < streamClipsArr.length; i++) {
      await clipService.setupClipDirectory(
        `./clips/push-button/${streamClipsArr[0].cameraName}`
      );
      clipService.createClip(
        streamClipsArr[0].rtspUrl,
        `./clips/push-button/${streamClipsArr[0].cameraName}`
      );
      // }
    } else {
      console.log("Stream Process does not exist");
      return res.send({
        message: "Received push button event. Stream process does not exist."
      });
    }
    return res.send({
      message: "Received push button event. Starting process to generate clip."
    });
  } catch (err) {
    log.error(err);
    return res
      .status(400)
      .send({ message: "An Error Occured", error: err.message });
  }
});

app.post("/clip/transaction", (req, res) => {
  // try {
  //   const proc = db
  //     .get("list")
  //     .find({ id: req.body.id })
  //     .value();
  //   if (!proc) {
  //     return res.status(400).send({
  //       message: `Unable to locate sream process with id ${req.body.id}`
  //     });
  //   }
  //   //stop process
  //   proc.proc.kill("SIGKILL");
  //   const processObj = db
  //     .get("list")
  //     .find({ id: req.body.id })
  //     .value();
  //   db.get("list")
  //     .remove({ id: req.body.id })
  //     .write();
  //   log.info(`CLEANUP: Deleting stream folder ${processObj.id}`);
  //   rimraf(`./videos/stream/${processObj.id}`, function() {
  //     log.info(`CLEANUP: Succssfully Deleted stream folder ${processObj.id}`);
  //   });
  //   return res.send({ message: "Stream process has been succesfully removed" });
  // } catch (err) {
  //   log.error(err);
  //   return res
  //     .status(400)
  //     .send({ message: "An Error Occured", error: err.message });
  // }
});

const server = https
  .createServer({ key: key, cert: cert }, app)
  .listen(config.HTTPS_PORT, () => {
    log.info(`Example app listening at https://localhost:${config.HTTPS_PORT}`);
  });
http.createServer(app).listen(config.HTTP_PORT, () => {
  log.info(`Example app listening at http://localhost:${config.HTTP_PORT}`);
});

// Do graceful shutdown
const shutdown = () => {
  server.close(() => {
    console.log("Gracefully shutting down the server");
  });
  process.exit(0);
  // Object.keys(processMapping).forEach(uri => {
  //   console.log("Closing FFMPEG process");
  //   // processMapping[uri].kill();
  //   // process.kill("SIGSTOP");
  // });
};

// Handle ^C
process.on("SIGINT", shutdown);

const onInit = async () => {
  const existingList = getList();
  existingList.forEach(obj => {
    log.info(`Starting up stream ${obj.id}`);
    const rtspStream = new RTSPStream(log);
    rtspStream.retryProcess(
      obj.rtspUrl,
      obj.id,
      `./videos/stream/${obj.id}`,
      db,
      false
    );
    // rtspStream.startStream(
    //   obj.rtspUrl,
    //   obj.id,
    //   `./videos/stream/${obj.id}`,
    //   db,
    //   false
    // );
  });
};

const getList = () => {
  const list = db.get("list").value();
  if (list) {
    return list;
  } else {
    db.defaults({ list: [] }).write();
    return db.get("list").value();
  }
};

onInit();
