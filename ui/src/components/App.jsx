import React, { Component } from "react";
import ReactHls from "react-hls";
import {
  Row,
  Button,
  Container,
  InputGroupAddon,
  InputGroup,
  Input,
  Col,
  FormGroup,
  Card
} from "reactstrap";

import { APIHandler } from "./api";

class App extends Component {
  constructor(props) {
    super(props);
    this.state = { streams: [], current: null, loading: false, message: "" };
    /** @property {APIHandler} apiHandler */
    this.apiHandler =
      this.props.apiHandler ||
      new APIHandler(process.env.API_URL || "http://localhost:8080");
    /** @property {HTMLInputElement} uriInput */
    this.uriInput;
  }

  componentDidMount() {
    this.apiHandler
      .listStreams()
      .then(streams => {
        this.setState({
          streams,
          current: streams.length ? 0 : null,
          loading: null,
          message: null,
          failureMessage: null
        });
      })
      .catch(e => console.log(e));
  }

  addInputStream() {
    this.setState({
      streams: this.state.streams,
      current: this.state.current,
      loading: true,
      message: "Wait",
      failureMessage: null
    });
    this.apiHandler
      .startStream(this.uriInput.value)
      .then(res => {
        const newStream = res.data.map(obj => ({
          uri: `${this.apiHandler.getUrl()}${obj.uri}`,
          mjpeg: `${this.apiHandler.getUrl()}${obj.mjpeg}`
        }));
        this.setState(({ streams, current }) => {
          return {
            streams: newStream,
            current: this.state.streams.length,
            loading: false,
            message: "Success",
            failureMessage: null
          };
        });
      })
      .catch(e => {
        this.setState({
          streams: this.state.streams,
          current: this.state.current,
          loading: false,
          message: `Failed`,
          failureMessage: e.response.data
        });
      });
  }

  render() {
    return (
      <Container className="my-4">
        <Row>
          <Col md={{ size: 8, offset: 2 }}>{this.renderPlayer()}</Col>
        </Row>
        <Row>
          <Col md={{ size: 8, offset: 2 }}>
            {this.renderInput()}
            {this.renderList()}
          </Col>
        </Row>
        <Row>
          <Col md={{ size: 8, offset: 2 }}>{this.renderImage()}</Col>
        </Row>
      </Container>
    );
  }

  renderInput() {
    return (
      <InputGroup className="my-1">
        <Input
          innerRef={elem => (this.uriInput = elem)}
          placeholder="rtsp://192.168.0.1:554/cam1_stream1"
        />
        <InputGroupAddon addonType="append">
          <Button color="primary" onClick={this.addInputStream.bind(this)}>
            Add
          </Button>
        </InputGroupAddon>
      </InputGroup>
    );
  }

  renderList() {
    const onChange = ev =>
      this.setState({ current: parseInt(ev.target.value, 10) });
    const playStreamFactory = current => () => this.setState({ current });
    const options = this.state.streams.map((obj, offset) => (
      <option key={obj.uri} value={offset} onClick={playStreamFactory(offset)}>
        {obj.uri}
      </option>
    ));
    return (
      <Input type="select" onChange={onChange} className="my-1">
        {options}
      </Input>
    );
  }

  renderImage() {
    const props = { style: { textAlign: "center", position: "relative" } };
    let content;
    if (this.state.message === "Wait") {
      content = (
        <span className="display-5 py-4">
          {" "}
          Please wait while the stream is being fetched....
        </span>
      );
    } else if (this.state.message === "Failed") {
      content = (
        <div className="display-5 py-4">Unable to fetch the stream.</div>
      );
    } else if (
      (this.state.message === null || this.state.message === "") &&
      this.state.streams.length < 1
    ) {
      content = (
        <span className="display-5 py-4">Select or add a stream below.</span>
      );
    } else {
      content = (
        <img
          width="300px"
          height="300px"
          src={`${this.state.streams[this.state.current].mjpeg}`}
        />
      );
    }
    return <Card {...props}>{content}</Card>;
  }

  renderPlayer() {
    const props = { style: { textAlign: "center", position: "relative" } };
    let content;
    if (this.state.message === "Wait") {
      content = (
        <span className="display-5 py-4">
          Please wait while the stream is being fetched....
        </span>
      );
    } else if (this.state.message === "Failed") {
      content = (
        <div className="display-5 py-4">
          Unable to fetch the stream.
          <p style={{ color: "red" }}>
            Error:{" "}
            {this.state.failureMessage.error &&
            this.state.failureMessage.error.hasOwnProperty("message")
              ? JSON.stringify(this.state.failureMessage.error.message)
              : JSON.stringify(this.state.failureMessage.error)}
          </p>
          <p style={{ color: "red" }}>
            Message: {this.state.failureMessage.message}
          </p>
        </div>
      );
    } else if (
      (this.state.message === null || this.state.message === "") &&
      this.state.streams.length < 1
    ) {
      content = (
        <span className="display-5 py-4">Select or add a stream below.</span>
      );
    } else {
      content = (
        <ReactHls
          width="100%"
          url={`${this.state.streams[this.state.current].uri}`}
          autoplay
        />
      );
    }
    return (
      <FormGroup>
        <Card {...props}>{content}</Card>
      </FormGroup>
    );
  }
}

export default App;
