const httpStatus = require("http-status");
const passport = require("passport");
const catchAsync = require("../utils/catchAsync");
const logger = require("../config/logger");
const appConstants = require("../constants/app.constants");
const gmailService = require("../services/gmail.service");

const googleAuth = catchAsync(async (req, res, next) => {
  logger.info("controllers - authController - googleAuth - start");
  passport.authenticate("google", {
    scope: appConstants.GOOGLE_SCOPE,
    accessType: "offline",
    prompt: "consent",
  })(req, res, next);
  logger.info("controllers - authController - googleAuth - end");
});

const googleAuthCallback = catchAsync(async (req, res, next) => {
  logger.info("controllers - authController - googleAuthCallback - start");
  passport.authenticate("google", { failureRedirect: "/404" }, (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect("/");
    }
    req.logIn(user, async (err) => {
      if (err) {
        logger.error(
          "controllers - authController - googleAuthCallback - login error"
        );
        logger.error("req.logIn: " + err);
        return next(err);
      }

      // Send watch request after successful login
      try {
        await gmailService.watchGmail(user._id);
      } catch (err) {
        logger.error("authController - googleAuthCallback - watchGmail error");
        logger.error("watchGmail: " + err);
        return next(err);
      }

      logger.info(
        "controllers - authController - googleAuthCallback - login success"
      );
      return res.redirect("https://api.ve.co/gmail/1.0/success"); // Adjust this path as needed
    });

    // const { access_token, refresh_token, email } = req.user;
    // return res.status(httpStatus.OK).json({ access_token, refresh_token, email });
  })(req, res, next);
  logger.info("controllers - authController - googleAuthCallback - end");
});

module.exports = {
  googleAuth,
  googleAuthCallback,
};
