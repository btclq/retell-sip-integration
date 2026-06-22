const router = require('express').Router();
router.post('/', (req, res) => {
  const {logger} = req.app.locals;
  const payload = req.body;
  
  const call_sid = payload.call_inbound?.custom_sip_headers?.['x-call-sid'] || '';
  logger.info(`extracted call_sid: ${call_sid}`);
  
  res.json({
    call_inbound: {
      dynamic_variables: {
        jambonz_call_sid: call_sid
      }
    }
  });
});
module.exports = router;
