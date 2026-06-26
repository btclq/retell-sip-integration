const useDialSipEndpointMethod = Number(process.env.USE_DIAL_SIP_ENDPOINT_METHOD) || 0;
const assert = require('assert');
const {registerCall, getE164, validateCountryCode} = require('../../lib/utils');
const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || false;
const OVERRIDE_FROM_USER = process.env.OVERRIDE_FROM_USER | false;

assert.ok(useDialSipEndpointMethod === 1 || process.env.RETELL_TRUNK_NAME,
  // eslint-disable-next-line max-len
  'RETELL_TRUNK_NAME env required when using elastic sip trunking method; it must contain the name of the jambonz BYOC trunk that connects to retell');

// IF a default country code has been set check its the right format,
if (DEFAULT_COUNTRY){
  validateCountryCode(DEFAULT_COUNTRY);
}
const sessions = {};

const service = ({logger, makeService}) => {
  const svc = makeService({path: '/retell'});

  svc.on('session:new', async(session) => {
    sessions[session.call_sid] = session;
    session.locals = {logger: logger.child({call_sid: session.call_sid})};
    let {from, to, direction, call_sid} = session;
    logger.info({session}, `new incoming call: ${session.call_sid}`);

    /* Send ping to keep alive websocket as some platforms timeout, 25sec as 30sec timeout is not uncommon */
    session.locals.keepAlive = setInterval(() => {
      session.ws.ping();
    }, 25000);

    let outboundFromRetell = false;
    if (session.direction === 'inbound' && process.env.PSTN_TRUNK_NAME) {
      const authenticatedUser = session.sip.headers['X-Authenticated-User'];
      const parentCallSid = session.sip_parent_call_sid;
      logger.info({authenticatedUser, parentCallSid, direction: session.direction}, 'checking outbound from retell');

      /* check if call is coming from Retell via authenticated user header */
      if (authenticatedUser && process.env.RETELL_SIP_CLIENT_USERNAME) {
        const username = authenticatedUser.split('@')[0];
        if (username === process.env.RETELL_SIP_CLIENT_USERNAME) {
          logger.info(`call ${session.call_sid} is coming from Retell (authenticated user)`);
          outboundFromRetell = true;
        }
      }

      /* fallback: check parent call SID - if present, this is an outbound call from Retell */
      if (!outboundFromRetell && parentCallSid) {
        logger.info(`call ${session.call_sid} is coming from Retell (parent call sid)`);
        outboundFromRetell = true;
      }
    }

    session
      .on('/refer', onRefer.bind(null, session))
      .on('close', onClose.bind(null, session))
      .on('error', onError.bind(null, session))
      .on('/dialAction', onDialAction.bind(null, session))
      .on('/referComplete', onReferComplete.bind(null, session));

    try {
      let target;
      let headers = {};
      if (outboundFromRetell) {
        /* call is coming from Retell, so we will forward it to the original dialed number */
        target = [
          {
            type: 'phone',
            number: to,
            trunk: process.env.PSTN_TRUNK_NAME
          }
        ];
        /* Workaround for SIPGATE, put User ID as from and CLI in header */
        if (OVERRIDE_FROM_USER) {
          from = OVERRIDE_FROM_USER;
        }
      }
      else if (useDialSipEndpointMethod) {
        /* https://docs.retellai.com/make-calls/custom-telephony#method-2-dial-to-sip-endpoint */
        const retell_call_id = await registerCall(logger, {
          agent_id: process.env.RETELL_AGENT_ID,
          from,
          to,
          direction,
          call_sid,
          retell_llm_dynamic_variables: {
            user_name: 'John Doe',
            user_email: 'john@example.com'
          }
        });
        logger.info({retell_call_id}, 'Call registered');
        target = [
          {
            type: 'sip',
            sipUri: `sip:${retell_call_id}@5t4n6j0wnrl.sip.livekit.cloud`
          }
        ];
      }
      else {
        /* https://docs.retellai.com/make-calls/custom-telephony#method-1-elastic-sip-trunking-recommended */
        const dest = DEFAULT_COUNTRY ? await getE164(logger, to, DEFAULT_COUNTRY) : to;
        target = [
          {
            type: 'phone',
            number: dest,
            trunk: process.env.RETELL_TRUNK_NAME
          }
        ];
      }

      session
        .dial({
          callerId: from,
          answerOnBridge: true,
          anchorMedia: true,
          referHook: '/refer',
          actionHook: '/dialAction',
          target,
          headers
        })
        .hangup()
        .send();
    } catch (err) {
      session.locals.logger.info({err}, `Error to responding to incoming call: ${session.call_sid}`);
      session.close();
    }
  });
};

const onRefer = (session, evt) => {
  const {logger} = session.locals;
  const {refer_details} = evt;
  logger.info({refer_details}, `session ${session.call_sid} received refer`);

  session
    .sip_refer({
      referTo: refer_details.refer_to_user,
      referredBy: evt.to,
      actionHook: '/referComplete'
    })
    .reply();
};

const onClose = (session, code, reason) => {
  delete sessions[session.call_sid];
  const {logger} = session.locals;
  clearInterval(session.locals.keepAlive);
  logger.info({session, code, reason}, `session ${session.call_sid} closed`);
};

const onError = (session, err) => {
  const {logger} = session.locals;
  logger.info({err}, `session ${session.call_sid} received error`);
};

const onDialAction = (session, evt) => {
  const {logger} = session.locals;
  if (evt.dial_call_status != 'completed') {
    logger.info(`outbound dial failed with ${evt.dial_call_status}, ${evt.dial_sip_status}`);
    session
      .sip_decline({status: evt.dial_sip_status})
      .reply();
  }
};

/* When the refer completes if we have an adulted call scenario hangup the original A leg */
const onReferComplete = (session, evt) => {
  const {logger} = session.locals;
  logger.info({evt}, 'referComplete');
  if (session.parent_call_sid) {
    logger.info(`Sending hangup to parent session ${session.parent_call_sid}`);
    const parentSession = sessions[session.parent_call_sid];
    parentSession
      .hangup()
      .send();
  } else {
    logger.info('No parent session');
  }
};

module.exports = service;
