require('dotenv').config();
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const celebrate = require("celebrate");
const { errorConverter, errorHandler } = require("./middleware/error");
const routes = require("./routes/index");
const cors = require("cors");
const session = require("express-session");
const passport = require('./services/passport');
const logger = require('./config/logger');
const app = express();

// set headers
app.use(helmet());

// use cors
app.use(cors());

// use compression
app.use(compression());

// parse json request body
app.use(express.json());

// Configure and initialize oAuth session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Initialize Passport and use sessions
app.use(passport.initialize());
app.use(passport.session());

//temp: ngrok for debugging
// app.post("/ngrockwebhook",(req,res)=>{
//   console.log("body: ", req.body);
//   res.status(200).send(req.body);
// })

// add routes
app.use("/ve", routes); //v1 can be used

app.get("/", async (req, res) => {
  res.send('<a href="https://api.ve.co/google/1.0/ve/auth/google">Authenticate with Google</a>');
});

app.get("https://api.ve.co/gmail/1.0/success", async (req, res) => {
  res.send('<h1>User authenticated with Google</h1>');
});

// convert celebrate errors
app.use(celebrate.errors());

// convert into ApiError incase of unexpected error
app.use(errorConverter);

// central error handling
app.use(errorHandler);

module.exports = app;
