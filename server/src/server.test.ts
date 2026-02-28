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
