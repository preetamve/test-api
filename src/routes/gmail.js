const router = require("express").Router();
const { celebrate, Joi, Segments } = require("celebrate");
const gmailController = require("../controllers/gmail.controller");
const { email, objectId } = require("../utils/customJoi");
const { validateTenantUserAccessToken } = require('../middleware/validateAccessToken')

router.post(
  "/send",
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      to: Joi.alternatives()
        .try(
          email(), // Single email
          Joi.array().items(email()) // Array of emails
        )
        .required(),
      cc: Joi.alternatives()
        .try(email(), Joi.array().items(email()))
        .optional(),
      bcc: Joi.alternatives()
        .try(email(), Joi.array().items(email()))
        .optional(),
      subject: Joi.string().required(),
      message: Joi.string().required(),
      inReplyTo: Joi.alternatives().try(Joi.string(), Joi.allow(null)).optional(),
      threadId: Joi.string().optional()
    }),
    [Segments.HEADERS]: Joi.object({
      tenantuserid: Joi.string().required(),
    }).unknown(true),
  }),
  gmailController.sendEmail
);

router.post('/watch', gmailController.watchGmail)

router.post("/pubsubpushnotification", gmailController.pubsubPushNotification)

module.exports = router;
