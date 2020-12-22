const express = require("express");
const path = require("path");
const UsersService = require("./users-service");

const usersRouter = express.Router();
const jsonBodyParser = express.json();

usersRouter.post("/", jsonBodyParser, async (req, res, next) => {
  for (const field of ["full_name", "user_name", "password"]) {
    if (!req.body[field]) {
      return res
        .status(400)
        .json({ error: `Missing '${field}' in request body` });
    }
  }

  const { full_name, user_name, password, nickname } = req.body;

  const passwordError = UsersService.validatePassword(password);
  if (passwordError) {
    return res.status(400).json({ error: passwordError });
  }

  const userExists = await UsersService.hasUserWithUserName(
    req.app.get("db"),
    user_name
  );
  if (userExists) {
    return res.status(400).json({ error: "User name already taken" });
  }

  const hashedPassword = await UsersService.hashPassword(password);

  const newUser = {
    full_name,
    user_name,
    password: hashedPassword,
    nickname,
    date_created: "now()",
  };

  const insertedUser = await UsersService.insertUser(
    req.app.get("db"),
    newUser
  );

  return res
    .status(201)
    .location(path.posix.join(req.originalUrl, `/${insertedUser.id}`))
    .json(UsersService.serializeUser(insertedUser));
});

module.exports = usersRouter;
