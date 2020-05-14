const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const serveHLSVideo = require("./controllers/serve-hls.controller");
const serveMjpegVideo = require("./controllers/serve-mjpeg.controller");
const RTSPStream = require("./controllers/start-rtsp.controller");
const MJPEGStream = require("./controllers/start-mjpeg.controller");
const rimraf = require("rimraf");
const { uuid } = require("uuidv4");
const app = express();
const port = 8080;
const log = require("lambda-log");
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

log.options.debug = process.env.DEBUG === "true" ? true : false;
log.info("Starting up the application");
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

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
  return res.send(list);
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
    new URL(req.body.uri);
  } catch (e) {
    return res.status(400).send({
      message: "An Error Occured",
      error: `Invalid URL::${req.body.uri}`
    });
  }
  try {
    const uniqueId = uuid();
    let resObj = {
      id: uniqueId,
      rtspUrl: req.body.uri,
      running: false,
      uri: `/videos/stream/${uniqueId}/index.m3u8`,
      cameraName: req.body.cameraName || "Aisle",
      mjpeg: `/videos/stream/${uniqueId}/mjpeg/stream.mjpeg`
    };
    // Start Check Existence
    const processExist = db
      .get("list")
      .find({ rtspUrl: req.body.uri })
      .value();
    if (processExist) {
      return res
        .status(400)
        .send({ message: `Stream already running ${req.body.uri}` });
    }
    // End Check Existence

    //Start new process
    const rtspStream = new RTSPStream(log);
    await rtspStream.startStream(
      req.body.uri,
      resObj.id,
      `./videos/stream/${resObj.id}`,
      db,
      true
    );
    db.get("list")
      .push(resObj)
      .write();
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
    process.kill(req.body.processId, "SIGSTOP");
    db.get("list")
      .find({ id: req.body.processId })
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
    process.kill(req.body.processId, "SIGCONT");
    db.get("list")
      .find({ id: req.body.processId })
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

app.post("/remove", (req, res) => {
  try {
    process.kill(req.body.processId, "SIGKILL");
    const processObj = db
      .get("list")
      .find({ processId: req.body.processId })
      .value();
    db.get("list")
      .remove({ processId: req.body.processId })
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

const server = app.listen(port, () =>
  log.info(`Example app listening at http://localhost:${port}`)
);

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
