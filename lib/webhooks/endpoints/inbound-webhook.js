const router = require('express').Router();
router.post('/', (req, res) => {
  const {logger} = req.app.locals;
  const payload = req.body;
  logger.info({payload}, 'inbound webhook');
  
  const call_sid = payload.call?.call_sid || payload.call_sid || '';
  logger.info({call_sid}, 'extracted call_sid');
  
  res.json({
    call_inbound: {
      dynamic_variables: {
        user_name: 'John Doe',
        user_email: 'john@example.com',
        jambonz_call_sid: call_sid
      },
      metadata: {
        random_id: '12345'
      }
    }
  });
});
module.exports = router;
