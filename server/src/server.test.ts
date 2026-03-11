import request from "supertest";
import server from "./server";
import type { Application } from "express";

describe("GET /users", function () {
  it("responds with json", (done) => {
    server.start().then((app: Application) => {
      return request(app)
        .get("/users")
        .expect("Content-Type", /json/)
        .expect(404)
        .then((response) => {
          expect(response.body.message).toEqual("Not found");

          server.stop();

          return done();
        })
        .catch((err) => done(err));
    });
  });
});

describe("POST /api/summarize", function () {
  it("sets no-cache headers", (done) => {
    server.start().then((app: Application) => {
      return request(app)
        .post("/api/summarize")
        .send({})
        .expect(400)
        .then((response) => {
          expect(response.headers["cache-control"]).toContain("no-store");
          expect(response.headers["pragma"]).toBe("no-cache");
          expect(response.headers["expires"]).toBe("0");

          server.stop();

          return done();
        })
        .catch((err) => done(err));
    });
  });
});

describe("POST /api/retrieve-latest", function () {
  it("sets no-cache headers", (done) => {
    server.start().then((app: Application) => {
      return request(app)
        .post("/api/retrieve-latest")
        .send({})
        .expect(400)
        .then((response) => {
          expect(response.headers["cache-control"]).toContain("no-store");
          expect(response.headers["pragma"]).toBe("no-cache");
          expect(response.headers["expires"]).toBe("0");

          server.stop();

          return done();
        })
        .catch((err) => done(err));
    });
  });
});
