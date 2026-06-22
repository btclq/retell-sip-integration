const router = require('express').Router();

router.use('/agent-events', require('./agent-events'));
router.use('/inbound-webhook', require('./inbound-webhook'));
router.use('/success', require('./success'));
router.use('/transfer-requested', require('./transfer-requested'));
module.exports = router;
