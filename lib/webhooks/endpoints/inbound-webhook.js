const router = require('express').Router();
router.post('/', (req, res) => {
  const {logger} = req.app.locals;
  const payload = req.body;
  logger.info(JSON.stringify(payload), 'inbound webhook full payload');
  
  const call_sid = payload.call?.call_sid || payload.call_sid || '';
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
