import request from "supertest";
import server from "./server";
import type { Application } from "express";

// Mock the marked module to avoid ESM import issues in Jest
jest.mock("marked", () => ({
  marked: jest.fn((text: string) => text),
}));

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
