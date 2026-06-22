const router = require('express').Router();

router.post('/transfer-requested', async (req, res) => {
  const logger = req.app.locals.logger;
  const {call_sid, agent_number, use_sip_refer} = req.body;
  
  logger.info({call_sid, agent_number, use_sip_refer}, 'transfer requested');

  try {
    const response = await fetch(
      `https://api.jambonz.cloud/v1/Accounts/8b373ecf-64c7-4a0c-a4bb-ffa4625d1816/Calls/${call_sid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 2d469499-d48a-4a4b-958a-f7b444e628b6'
        },
        body: JSON.stringify({
          call_hook: {
            url: use_sip_refer 
              ? `sip:${agent_number}`
              : `sip:${agent_number}`,
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
      logger.error({error}, 'transfer failed');
      res.json({status: 'transfer failed', error});
    }
  } catch (err) {
    logger.error({err}, 'error initiating transfer');
    res.json({status: 'error', message: err.message});
  }
});

module.exports = router;
