const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const Db = require("./dataLayer");
const { createJWT } = require('./jwt.service');
const { ObjectId } = require('mongodb');
const scope = require("../constants/app.constants");
const { watchGmail } = require("../services/gmail.service");

// Serialize user into the session
passport.serializeUser((tenantUser, done) => {
  done(null, tenantUser._id);
});

// Deserialize user from the session
passport.deserializeUser(async (tenantUserId, done) => {
  try {
    const iTenantUser = new Db("tenantusers");
    const tenantUser = await iTenantUser.findOne({ _id: new ObjectId(tenantUserId) });
    done(null, tenantUser);
  } catch (err) {
    done(err, null);
  }
});

// Configure the Google strategy for use by Passport
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
      passReqToCallback: true,
      scope: scope.GOOGLE_SCOPE,
      accessType: "offline",
      prompt: "consent",
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const iTenantUser = new Db("tenantusers");
        const tenantUser = await iTenantUser.findOne({ email: profile.emails[0].value });

        if (tenantUser) {
          // Update existing user with Google data
          const updateData = {
            $set: {
              'googleData.profile_id': profile.id,
              'googleData.access_token': accessToken,
              'googleData.refresh_token': refreshToken || tenantUser.googleData.refresh_token,
            }
          };
          
          if (!tenantUser.signupMethods.includes("google")) {
            updateData.$addToSet = { signupMethods: "google" };
          }

          await iTenantUser.updateOne({ email: profile.emails[0].value }, updateData);
        } else {
          // Create new user if not exists
          const newTenantUser = {
            googleData: {
              profile_id: profile.id,
              access_token: accessToken,
              refresh_token: refreshToken
            },
            email: profile.emails[0].value,
            signupMethods: ["google"],
          };
          
          await iTenantUser.insertOne(newTenantUser);
        }

        const user = await iTenantUser.findOne({ email: profile.emails[0].value });

        const tokenPayload = {
          tenantUser: user._id,
          email: profile.emails[0].value,
        };

        const jwtAccessToken = createJWT(tokenPayload);

        req.tenantUser = {
          ...user,
          jwtAccessToken,
        };

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
