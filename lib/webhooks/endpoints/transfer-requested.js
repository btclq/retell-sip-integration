const router = require('express').Router();
router.post('/', async (req, res) => {
  const logger = req.app.locals.logger;
  const {call_sid, agent_number, use_sip_refer} = req.body;
  
  logger.info({call_sid, agent_number, use_sip_refer}, 'transfer requested');
  try {
    const response = await fetch(
      `https://api.jambonz.cloud/v1/Accounts/${process.env.JAMBONZ_ACCOUNT_SID}/Calls/${call_sid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.JAMBONZ_API_KEY}`
        },
        body: JSON.stringify({
          call_hook: {
            url: `sip:${agent_number}`,
            method: use_sip_refer ? 'REFER' : 'INVITE'
          }
        })
      }
    );
    if (response.ok) {
      logger.info('transfer initiated successfully');
      res.json({status: 'transfer initiated'});
    } else {
      const error = await response.text();
logger.error(`transfer failed with status ${response.status}: ${error}`);
res.json({status: 'transfer failed', error});
    }
  } catch (err) {
    logger.error({err}, 'error initiating transfer');
    res.json({status: 'error', message: err.message});
  }
});
module.exports = router;
