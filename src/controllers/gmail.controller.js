const httpStatus = require("http-status");
const catchAsync = require("../utils/catchAsync");
const logger = require("../config/logger");
const gmailService = require("../services/gmail.service");

const sendEmail = catchAsync(async (req, res) => {
  logger.info("Controllers - GmailController - sendEmail - start");
  //   const {tenantUserId} = req;
  const  tenantUserId  = req.headers.tenantuserid; // Extract from headers
  const response = await gmailService.sendEmail(tenantUserId, req.body);
  res.status(httpStatus.OK).json(response);
});

const watchGmail = catchAsync(async (req, res) => {
  logger.info("controller-watchEmail")
  const tenantUserId = req.headers.tenantuserid
  const response = await gmailService.watchGmail(tenantUserId)
  res.status(httpStatus.OK).json(response)
})

const pubsubPushNotification = catchAsync(async (req, res) => {
  logger.info("Controllers - pubsubPushNotification - start");
  
  const message = req.body.message;
  if (!message) {
    res.status(400).send('Bad Request: missing message');
    return;
  }

  const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
  const { emailAddress, historyId } = data;

  logger.info(`Processing Pub/Sub message for email: ${emailAddress}, historyId: ${historyId}`);

  const response = await gmailService.handleEmailReplies(emailAddress, historyId);
  
  res.status(httpStatus.OK).json({replyHistory: response});
});

module.exports = { sendEmail, watchGmail, pubsubPushNotification };
