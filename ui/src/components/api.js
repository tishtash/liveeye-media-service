import axios from "axios";

export class APIHandler {
  constructor(url) {
    this.url = url;
  }
  getUrl() {
    return this.url;
  }
  listStreams() {
    return axios({
      responseType: "json",
      method: "GET",
      url: `${this.url}/list`
    }).then(res => {
      return res.data.map(obj => ({
        uri: `${this.url}${obj.uri}`,
        mjpeg: `${this.url}${obj.mjpeg}`
      }));
    });
  }
  startStream(uri) {
    return axios({
      method: "POST",
      url: `${this.url}/start`,
      responseType: "json",
      data: { uri }
    });
  }
}
