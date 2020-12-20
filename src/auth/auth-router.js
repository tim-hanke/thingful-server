const express = require("express");
const AuthService = require("./auth-service");

const authRouter = express.Router();
const jsonBodyParser = express.json();

authRouter.post("/login", jsonBodyParser, async (req, res, next) => {
  const { user_name, password } = req.body;
  const loginUser = { user_name, password };

  for (const [key, value] of Object.entries(loginUser)) {
    if (value == null) {
      return res
        .status(400)
        .json({ error: `Missing '${key}' in request body` });
    }
  }

  try {
    const dbUser = await AuthService.getUserWithUserName(
      req.app.get("db"),
      loginUser.user_name
    );
    if (!dbUser) {
      return res.status(400).json({ error: "Incorrect user_name or password" });
    }

    const compareMatch = await AuthService.comparePasswords(
      loginUser.password,
      dbUser.password
    );
    if (!compareMatch) {
      return res.status(400).json({ error: "Incorrect user_name or password" });
    }

    const sub = dbUser.user_name;
    const payload = { user_id: dbUser.id };
    res.send({ authToken: AuthService.createJwt(sub, payload) });
  } catch (error) {
    next(error);
  }
});

module.exports = authRouter;
