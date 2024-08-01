const router = require("express").Router();
const authController= require('../controllers/auth.controller');

// Define routes
router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleAuthCallback);

module.exports = router;
