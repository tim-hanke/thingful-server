const knex = require("knex");
const bcrypt = require("bcrypt");
const app = require("../src/app");
const helpers = require("./test-helpers");

describe("Users endpoints", function () {
  let db;

  const { testUsers } = helpers.makeThingsFixtures();
  const testUser = testUsers[0];

  before("make knex instance", () => {
    db = knex({
      client: "pg",
      connection: process.env.TEST_DB_URL,
    });
    app.set("db", db);
  });

  after("disconnect from db", () => db.destroy());

  before("cleanup", () => helpers.cleanTables(db));

  afterEach("cleanup", () => helpers.cleanTables(db));

  describe("POST /api/users", () => {
    context("User Validation", () => {
      beforeEach("insert users", () => helpers.seedUsers(db, testUsers));

      const requiredFields = ["user_name", "password", "full_name"];

      requiredFields.forEach((field) => {
        const registrationAttemptBody = {
          user_name: "test user_name",
          password: "test password",
          full_name: "test full_name",
          nickname: "test nickname",
        };

        it(`responds with 400 required error when '${field}' is missing`, () => {
          delete registrationAttemptBody[field];

          return supertest(app)
            .post("/api/users")
            .send(registrationAttemptBody)
            .expect(400, { error: `Missing '${field}' in request body` });
        });
      });

      it(`responds with 400 'Password must be longer than 8 characters' when password too short`, () => {
        const userShortPassword = {
          user_name: "test user_name",
          password: "1234567",
          full_name: "test full_name",
        };

        return supertest(app)
          .post("/api/users")
          .send(userShortPassword)
          .expect(400, {
            error: "Password must be longer than 8 characters",
          });
      });

      it(`responds with 400 'Password must be less than 72 characters' when password too long`, () => {
        const userLongPassword = {
          user_name: "test user_name",
          password: "*".repeat(73),
          full_name: "test full_name",
        };
        return supertest(app)
          .post("/api/users")
          .send(userLongPassword)
          .expect(400, { error: "Password must be less than 72 characters" });
      });

      it(`responds with 400 error when password starts with spaces`, () => {
        const userPasswordStartsSpaces = {
          user_name: "test user_name",
          password: " 1AB!cD@",
          full_name: "test full_name",
        };
        return supertest(app)
          .post("/api/users")
          .send(userPasswordStartsSpaces)
          .expect(400, {
            error: "Password must not start or end with empty spaces",
          });
      });

      it(`responds with 400 error when password ends with spaces`, () => {
        const userPasswordEndsSpaces = {
          user_name: "test user_name",
          password: "1AB!cD@ ",
          full_name: "test full_name",
        };
        return supertest(app)
          .post("/api/users")
          .send(userPasswordEndsSpaces)
          .expect(400, {
            error: "Password must not start or end with empty spaces",
          });
      });

      const passwordsNotComplex = [
        {
          missing: "lowercase character",
          password: "AAA111@@@",
        },
        {
          missing: "uppercase character",
          password: "aaa111@@@",
        },
        {
          missing: "number",
          password: "aaaAAA@@@",
        },
        {
          missing: "special character",
          password: "aaaAAA111",
        },
      ];

      passwordsNotComplex.forEach((password) => {
        it(`responds with 400 error when password doesn't contain ${password.missing}`, () => {
          const userPasswordNotComplex = {
            user_name: "test user_name",
            password: password.password,
            full_name: "test full_name",
          };

          return supertest(app)
            .post("/api/users")
            .send(userPasswordNotComplex)
            .expect(400, {
              error:
                "Password must contain 1 upper case, lower case, number and special character",
            });
        });
      });

      it(`responds with 400 'user name already taken' when user_name isn't unique`, () => {
        const duplicateUser = {
          user_name: testUser.user_name,
          password: "aaAA11!!",
          full_name: "test full_name",
        };

        return supertest(app)
          .post("/api/users")
          .send(duplicateUser)
          .expect(400, { error: "User name already taken" });
      });
    });

    context("Happy path", () => {
      it(`responds 201, serialized user, storing bcrypted password`, () => {
        const newUser = {
          user_name: "test user_name",
          password: "aaAA11@@",
          full_name: "test full_name",
        };

        return supertest(app)
          .post("/api/users")
          .send(newUser)
          .expect(201)
          .expect((res) => {
            expect(res.body).to.have.property("id");
            expect(res.body.user_name).to.eql(newUser.user_name);
            expect(res.body.full_name).to.eql(newUser.full_name);
            expect(res.body.nickname).to.eql("");
            expect(res.body).to.not.have.property("password");
            expect(res.headers.location).to.eql(`/api/users/${res.body.id}`);
            const expectedDate = new Date().toLocaleString("en", {
              timeZone: "UTC",
            });
            const actualDate = new Date(res.body.date_created).toLocaleString();
            expect(actualDate).to.eql(expectedDate);
          })
          .expect((res) =>
            db
              .from("thingful_users")
              .select("*")
              .where({ id: res.body.id })
              .first()
              .then((row) => {
                expect(row.user_name).to.eql(newUser.user_name);
                expect(row.full_name).to.eql(newUser.full_name);
                expect(row.nickname).to.eql(null);
                const expectedDate = new Date().toLocaleString("en", {
                  timeZone: "UTC",
                });
                const actualDate = new Date(row.date_created).toLocaleString();
                expect(actualDate).to.eql(expectedDate);
                return bcrypt.compare(newUser.password, row.password);
              })
              .then((compareMatch) => {
                expect(compareMatch).to.be.true;
              })
          );
      });
    });
  });
});
