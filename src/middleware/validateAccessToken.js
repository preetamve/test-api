/* eslint-disable consistent-return */
const httpStatus = require("http-status");
const { verifyJWT } = require("../services/jwt.service");
const ApiError = require("../utils/ApiError");
const logger = require("../config/logger");
const { ObjectId } = require("mongodb");
const axios = require("axios");
const Db = require("../services/dataLayer");
const _ = require("lodash");
const { watchGmail } = require("../services/gmail.service");

const validateTenantUserAccessToken = async (req, res, next) => {
  try {
    logger.info("Middleware-Validation");
    const accessToken = req.headers["x-access-token"];
    if (!accessToken) throw new Error("Access token required");

    const payload = await verifyJWT(accessToken); //refrence: ask for credentials
    const { userType, user_id } = payload;

    if (userType !== "tenantUser")
      throw new Error("Accessible by tenantUser only");

    const iTenantUser = new Db("tenantusers"); // refrence: for verifiaction use tenenat collection
    const tenantUser = await iTenantUser.findOne({ _id: ObjectId(user_id) });
    if (!tenantUser) throw new Error("User not found");

    // if (!tenantUser.isEmailVerified) throw new Error("Email not verified");
    // if (!tenantUser.isAccountVerified) throw new Error("Account not verified"); //refrence: already verifies once user becomes tenantuser

    const workspaceId = req.params.workspaceId;
    const hasAdminRole = _.some(
      tenantUser.accessibleTenants,
      (tenant) => tenant.workspaceId === workspaceId && tenant.role === "admin" // refrence: this check has to be done from tenant collection
    );

    if (!hasAdminRole)
      throw new Error("Admin role required to access google api services");

    if (!tenantUser.authMethods.includes("google")) {
      const redirectUrl = "http://localhost:8000/ve/auth/google";
      const message = "Google authentication is required";
      return res
        .status(httpStatus.TEMPORARY_REDIRECT)
        .redirect(`${redirectUrl}?message=${encodeURIComponent(message)}`);
    }

    // Watch for mail-box changes
    await watchGmail(tenantUser._id);

    req.tenantUserId = ObjectId(tenantUser._id); //tenant doc
    logger.info("Middleware-Validation-Complete");
    next();
  } catch (err) {
    return next(new ApiError(httpStatus.UNAUTHORIZED, err.message));
  }
};

const tenantUserSystemInfo = async (req, res, next) => {
  try {
    const ipInfo = await axios.get(`https://ipapi.co/${req.ip}/json/`);
    req.meta = {
      ...ipInfo.data,
      userAgent: req.get("User-Agent"),
    };
    next();
  } catch (err) {
    logger.error("Middleware-Validation-Complete");
    return next(new ApiError(httpStatus.UNAUTHORIZED, err.message));
  }
};

module.exports = { validateTenantUserAccessToken, tenantUserSystemInfo };
