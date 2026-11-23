import http from 'http';

class TestRequest {
  constructor(app, method, url) {
    this.app = app;
    this.method = method;
    this.url = url;
    this._body = null;
    this._headers = {
      'content-type': 'application/json',
      'accept': 'application/json'
    };
  }

  set(header, value) {
    this._headers[header.toLowerCase()] = value;
    return this;
  }

  send(data) {
    this._body = data;
    return this;
  }

  then(resolve, reject) {
    return new Promise((resResolve) => {
      const socket = null;
      const req = new http.IncomingMessage(socket);
      req.method = this.method;
      req.url = this.url;
      req.headers = this._headers;
      req._body = true; // Signals express body-parser to skip stream reading
      req.body = this._body || {};

      const res = new http.ServerResponse(req);
      let rawOutput = '';

      const originalWrite = res.write.bind(res);
      res.write = (chunk, encoding, cb) => {
        if (chunk) rawOutput += chunk.toString();
        return true;
      };

      const originalEnd = res.end.bind(res);
      res.end = (chunk, encoding, cb) => {
        if (chunk) rawOutput += chunk.toString();

        let parsedBody = rawOutput;
        try {
          parsedBody = JSON.parse(rawOutput);
        } catch (e) {
          // Leave as string if not JSON
        }

        resResolve({
          status: res.statusCode,
          body: parsedBody,
          headers: res.getHeaders()
        });
      };

      this.app.handle(req, res, (err) => {
        if (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Not Found' }));
        }
      });
    }).then(resolve, reject);
  }
}

export function testClient(app) {
  return {
    get: (url) => new TestRequest(app, 'GET', url),
    post: (url) => new TestRequest(app, 'POST', url),
    put: (url) => new TestRequest(app, 'PUT', url),
    delete: (url) => new TestRequest(app, 'DELETE', url)
  };
}
