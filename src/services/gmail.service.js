const { google } = require("googleapis");
const logger = require("../config/logger");
const Db = require("../services/dataLayer");
const ApiError = require("../utils/ApiError");
const httpStatus = require("http-status");
const { ObjectId } = require("mongodb");
const { getTimestamp } = require("../helpers/index");

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const setOAuth2Credentials = async (tenantUserId) => {
  const db = new Db("tenantusers");
  const tenantUser = await db.findOne({ _id: new ObjectId(tenantUserId) });
  if (!tenantUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found at setOAuth2Credentials");
  }
  oAuth2Client.setCredentials({
    access_token: tenantUser.googleData.access_token,
    refresh_token: tenantUser.googleData.refresh_token,
  });
  oAuth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      await db.updateOne(
        { _id: tenantUserId },
        {
          $set: {
            "googleData.access_token": tokens.access_token,
            "googleData.refresh_token": tokens.refresh_token,
          },
        }
      );
    } else {
      await db.updateOne(
        { _id: tenantUserId },
        { $set: { "googleData.access_token": tokens.access_token } }
      );
    }
  });
  return tenantUser;
};

const watchGmail = async (tenantUserId) => {
  try {
    const tenantUser = await setOAuth2Credentials(tenantUserId);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    const watchResponse = await gmail.users.watch({
      userId: tenantUser.googleData.profile_id,
      requestBody: {
        topicName: "projects/nodeauth-429506/topics/gmailapi",
      },
    });

    logger.info("Gmail API watch request response:", watchResponse.data);
    // Save the historyId in tenantuser googledata
    const db = new Db("tenantusers");
    await db.updateOne(
      { _id: new ObjectId(tenantUserId) },
      { $set: { "googleData.historyId": watchResponse.data.historyId } }
    );

    return watchResponse.data;
  } catch (error) {
    logger.error("Error setting up Gmail watch:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Error setting up Gmail watch"
    );
  }
};

const getEmailslist = async (userId) => {
  try {
    logger.info("services - GmailService - getEmails");
    const user = await setOAuth2Credentials(userId);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const response = await gmail.users.messages.list({
      userId: user.googleData.profile_id,
    });
    return { response: response.data.messages };
  } catch (error) {
    logger.error("services - GmailService - getEmails - error", error);
    throw new Error("Internal Error while fetching emails: " + error.message);
  }
};

const getEmailMessages = async (userId, messageIds) => {
  try {
    logger.info("services - GmailService - getEmailMessages");
    const user = await setOAuth2Credentials(userId);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const message = await gmail.users.messages.get({
          userId: user.googleData.profile_id,
          id,
        });
        return message.data;
      })
    );
    return { messages };
  } catch (error) {
    logger.error("services - GmailService - getEmailMessages - error", error);
    throw new Error(
      "Internal Error while fetching email messages: " + error.message
    );
  }
};

const createEmail = (to, from, subject, message, cc, bcc, inReplyTo) => {
  const headers = [
    'Content-Type: text/plain; charset="UTF-8"\n',
    "MIME-Version: 1.0\n",
    "Content-Transfer-Encoding: 7bit\n",
    `To: ${to}\n`,
    `From: ${from}\n`,
    cc ? `Cc: ${cc}\n` : "",
    bcc ? `Bcc: ${bcc}\n` : "",
    `Subject: ${subject}\n`,
    inReplyTo ? `In-Reply-To: ${inReplyTo}\n` : "",
  ].join("");

  const body = headers + "\n" + message;

  const encodedMail = Buffer.from(body)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return encodedMail;
};

const sendEmail = async (tenantUserId, body) => {
  const emailDb = new Db("emails");
  try {
    logger.info("services - GmailService - sendEmail");
    const tenantUser = await setOAuth2Credentials(tenantUserId);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Fetch the original email from the database to get the threadId if inReplyTo is provided
    let threadId = null;
    if (body.inReplyTo) {
      const originalEmail = await emailDb.findOne({
        messages: {
          $elemMatch: {
            messageId: body.inReplyTo,
          },
        },
      });
      if (!originalEmail) {
        throw new ApiError(httpStatus.NOT_FOUND, "Original email not found");
      }
      threadId = originalEmail.threadId;
    }

    const raw = createEmail(
      body.to,
      tenantUser.email,
      body.subject,
      body.message,
      body.cc,
      body.bcc,
      body.inReplyTo
    );

    const requestBody = { raw: raw };

    // Include threadId in the request body if it's set
    if (threadId) {
      requestBody.threadId = threadId;
    }

    const response = await gmail.users.messages.send({
      userId: tenantUser.googleData.profile_id,
      requestBody: requestBody,
    });

    // Extract Message-ID header
    const messageDetails = await gmail.users.messages.get({
      userId: tenantUser.googleData.profile_id,
      id: response.data.id,
    });

    const messageIdHeader = extractHeader(
      messageDetails.data.payload.headers,
      "Message-ID"
    ); //ID to track email replies

    const emailData = {
      messageId: response.data.id,
      messageIdHeader: messageIdHeader,
      from: tenantUser.email,
      to: Array.isArray(body.to) ? body.to : [body.to],
      cc: body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : [],
      bcc: body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : [],
      subject: body.subject,
      message: body.message,
      labelId: response.data.labelIds,
      timestamp: getTimestamp(),
      inReplyTo: body.inReplyTo || null,
    };

    if (threadId) {
      await emailDb.updateOne(
        { threadId: threadId, tenantUserId: new ObjectId(tenantUserId) },
        { $push: { messages: emailData } },
        { upsert: true }
      );
    } else {
      await emailDb.insertOne({
        threadId: response.data.threadId,
        tenantUserId: new ObjectId(tenantUserId),
        messages: [emailData],
      });
    }

    logger.info("Email sent successfully!");
    return { response: response.data };
  } catch (error) {
    logger.error("services - GmailService - sendEmail - error", error);
    throw new ApiError(
      httpStatus.CONFLICT,
      "Internal Error while sending email: " + error.message
    );
  }
};


//*** modified OAuth2 listners *** */

// Function to configure OAuth2Client and handle token events
const configureOAuth2Client = async (tenantUserId) => {
  const db = new Db("tenantusers");
  const tenantUser = await db.findOne({ _id: new ObjectId(tenantUserId) });
  if (!tenantUser) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found at configureOAuth2Client");
  }

  oAuth2Client.setCredentials({
    access_token: tenantUser.googleData.access_token,
    refresh_token: tenantUser.googleData.refresh_token,
  });

  // Remove existing listener before adding a new one
  oAuth2Client.removeAllListeners("tokens");

  oAuth2Client.on("tokens", async (tokens) => {
    if (tokens.refresh_token) {
      await db.updateOne(
        { _id: tenantUserId },
        {
          $set: {
            "googleData.access_token": tokens.access_token,
            "googleData.refresh_token": tokens.refresh_token,
          },
        }
      );
    } else {
      await db.updateOne(
        { _id: tenantUserId },
        { $set: { "googleData.access_token": tokens.access_token } }
      );
    }
  });

  return tenantUser;
};

const ensureOAuth2Client = async (tenantUserId) => {
  if (!oAuth2Client.credentials || !oAuth2Client.credentials.access_token) {
    await configureOAuth2Client(tenantUserId);
  }
};




const handleEmailReplies = async (emailAddress, newHistoryId) => {
  try {
    logger.info("handleEmailReplies - start");
    const db = new Db("tenantusers");
    const tenantUserRecord = await db.findOne({ email: emailAddress });
    if (!tenantUserRecord) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found at tenantUserRecord");
    }
    await ensureOAuth2Client(tenantUserRecord._id);
    // const tenantUser = await setOAuth2Credentials(tenantUserRecord._id);
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Use the previous historyId stored in the DB
    const previousHistoryId = tenantUserRecord.googleData.historyId;
    if (!previousHistoryId) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Previous historyId not found"
      );
    }

    const historyResponse = await gmail.users.history.list({
      userId: tenantUserRecord.googleData.profile_id,
      startHistoryId: previousHistoryId,
    });
    logger.info(
      `handleEmailReplies - historylist fetched using previousHistoryId: ${previousHistoryId}`
    );

    if (!historyResponse.data.history) {
      logger.info(
        `No history to update from this push notification AND new historyId saved: ${historyResponse.data.historyId}`
      );
      await db.updateOne(
        { _id: new ObjectId(tenantUserRecord._id) },
        { $set: { "googleData.historyId": historyResponse.data.historyId } }
      );
      return { updateNewHistoryId: historyResponse.data.historyId };
    }

    // const histories = historyResponse.data.history || [];
    const histories = historyResponse.data.history.filter((history) => {
      // Check if 'messagesAdded' exists and it doesn't have 'DRAFT' in its 'labelIds'
      return (
        history.messagesAdded &&
        !history.messagesAdded.some((added) =>
          added.message.labelIds.includes("DRAFT")
        )
      );
    });
    
    const savedReplies = [];

    for (const history of histories) {
      const historyMessagesAdded = history.messagesAdded || [];

      for (const added of historyMessagesAdded) {
        const message = added.message;

        const messageDetails = await gmail.users.messages.get({
          userId: tenantUserRecord.googleData.profile_id,
          id: message.id,
        });

        const inReplyToHeader = extractHeader(
          messageDetails.data.payload.headers,
          "In-Reply-To",
          "Message-ID"
        );
        if (!inReplyToHeader) {
          logger.info(
            "This push notification was for new mail initiated! | inReplyToHeader not found"
          );
        }
        logger.info("historyEmailReplies - messageDetails - fetched");

        const emailDb = new Db("emails");
        const originalEmail = await emailDb.findOne({
          tenantUserId: new ObjectId(tenantUserRecord._id),
          messages: { $elemMatch: { messageIdHeader: inReplyToHeader } },
        });

        if (originalEmail) {
          const isReplyAlreadySaved = originalEmail.messages.some(
            (msg) => msg.messageId === messageDetails.data.id
          );

          if (!isReplyAlreadySaved) {
            const emailData = {
              messageId: messageDetails.data.id,
              messageIdHeader: extractHeader(messageDetails.data.payload.headers,"Message-ID"),
              from: extractEmailAddress(extractHeader(messageDetails.data.payload.headers, "From")),
              to: extractEmailAddress(extractHeader(messageDetails.data.payload.headers,"To")),
              cc: extractEmailAddress(extractHeader(messageDetails.data.payload.headers,"Cc")),
              bcc: extractEmailAddress(extractHeader(messageDetails.data.payload.headers,"Bcc")),
              subject: extractHeader(messageDetails.data.payload.headers,"Subject"),
              message: extractBody(messageDetails.data.payload),
              labelId: messageDetails.data.labelIds,
              timestamp: getTimestamp(),
              inReplyTo: inReplyToHeader || null,
            };

            await emailDb.updateOne(
              {
                threadId: messageDetails.data.threadId,
                tenantUserId: new ObjectId(tenantUserRecord._id),
              },
              { $push: { messages: emailData } },
              { upsert: true }
            );

            savedReplies.push(emailData);
            logger.info(
              `Reply with messageId ${emailData.messageId} inserted into database.`
            );
          } else {
            logger.info(
              `Skipping duplicate reply with messageId ${messageDetails.data.id}.`
            );
          }
        } else {
          logger.info(
            `Skipping message with threadId ${messageDetails.data.threadId} as it does not part of existing emails of DB.`
          );
        }
      }
    }

    await db.updateOne(
      { _id: new ObjectId(tenantUserRecord._id) },
      { $set: { "googleData.historyId": historyResponse.data.historyId } }
    );
    logger.info(
      `handleEmailReplies - END - new historyId saved: ${historyResponse.data.historyId}`
    );
    return savedReplies;
  } catch (error) {
    logger.error("Error saving email replies history:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Error saving email replies history"
    );
  }
};

const extractHeader = (headers, primaryName, fallbackName) => {
  const primaryHeader = headers.find(
    (header) => header.name.toLowerCase() === primaryName.toLowerCase()
  );
  if (primaryHeader) {
    return primaryHeader.value;
  }

  if (fallbackName) {
    const fallbackHeader = headers.find(
      (header) => header.name.toLowerCase() === fallbackName.toLowerCase()
    );
    return fallbackHeader ? fallbackHeader.value : null;
  }

  return null;
};

const extractAddressHeaders = (headers, name) => {
  const header = headers.find(
    (header) => header.name.toLowerCase() === name.toLowerCase()
  );
  return header ? header.value.split(",").map((addr) => addr.trim()) : [];
};

const extractBody = (payload) => {
  const parts = payload.parts || [];
  for (const part of parts) {
    if (part.mimeType === "text/plain") {
      return Buffer.from(part.body.data, "base64").toString("utf-8");
    }
  }
  return "";
};

const extractEmailAddress = (headerValue) => {
  if (!headerValue) return [];

  // Regular expression to match email addresses within angle brackets
  const emailRegex = /<([^>]+)>/g;
  const matches = [];
  let match;

  // Extract email addresses within angle brackets
  while ((match = emailRegex.exec(headerValue)) !== null) {
    matches.push(match[1]);
  }

  // If no matches are found, split the header value by commas and trim spaces
  if (matches.length === 0) {
    return headerValue.split(",").map(email => email.trim());
  }

  return matches;
};


module.exports = {
  getEmailslist,
  getEmailMessages,
  watchGmail,
  createEmail,
  sendEmail,
  handleEmailReplies,
};
