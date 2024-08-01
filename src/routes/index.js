const router = require("express").Router();
const authRoutes = require('./auth'); // Ensure correct import
const gmailRoutes = require('./gmail');
// Use auth routes
router.use('/auth', authRoutes);
router.use('/gmail', gmailRoutes)

module.exports = router;
