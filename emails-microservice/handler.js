import R from 'ramda';
import base64url from 'base64-url';
import Api from './src/Api';
import ApiGatewayUtils from './src/lib/utils/ApiGatewayUtils';
import crypto from 'crypto';

const renameKeys = R.curry((keysMap, obj) =>
  R.reduce((acc, key) => R.assoc(keysMap[key] || key, obj[key], acc), {}, R.keys(obj)));
const addHttpsIfNoProtocol = function addHttpsToUrl(url) {
  let uri = url;
  if (!/^(?:f|ht)tps?\:\/\//.test(uri)) {
    uri = `https://${uri}`;
  }
  return uri;
};

const decrypt = function(text) {
  const  decipher = crypto.createDecipher("aes-128-cbc", process.env.ENCRYPTION_PWD);
  let dec = decipher.update(text,'base64','utf8');
  dec += decipher.final('utf8');
  return dec;
};

const httpRequestToEmailEvent = (request) => {
  const { headers } = request;
  return R.pipe(
    R.pick(['pathParameters', 'queryStringParameters']),
    R.values,
    R.mergeAll,
    R.pick(['campaignId', 'linkId', 'r', 'u', 'l', 's']),
    renameKeys({ r: 'recipientId', u: 'userId', l: 'listId', s: 'segmentId' }),
    R.evolve({ userId: base64url.decode }),
    R.merge({ httpHeaders: headers })
  )(request);
};

export function processSesNotification(snsEvent, context, callback) {
  const event = R.pipe(
    R.pathOr({}, ['Records', 0, 'Sns', 'Message']),
    JSON.parse
  )(snsEvent);
  return Api.processSesNotification(event)
    .then(() => callback(null, true))
    .catch(err => callback(err));
}

export function processLinkClick(event, context, callback) {
  let url;
  try {
    url = R.pipe(
      R.pathOr(undefined, ['queryStringParameters', 'ctx']),
      decrypt,
      decodeURIComponent,
      addHttpsIfNoProtocol
    )(event);
  } catch (error) {
    return Promise.resolve(ApiGatewayUtils.redirectTo({ url: 'https://moonmail.io', callback }));
  }
  const linkClick = httpRequestToEmailEvent(event);
  return Api.processLinkClick(linkClick)
    .then(() => ApiGatewayUtils.redirectTo({ url, callback }))
    .catch(() => ApiGatewayUtils.redirectTo({ url, callback }));
}

export function processEmailOpen(event, context, callback) {
  const emailOpen = httpRequestToEmailEvent(event);
  return Api.processEmailOpen(emailOpen)
    .then(() => callback(null, ApiGatewayUtils.buildResponse({})))
    .catch(() => callback(null, ApiGatewayUtils.buildResponse({})));
}

export function persistEmailEvent(snsEvent, context, callback) {
  const event = R.pipe(
    R.pathOr({}, ['Records', 0, 'Sns', 'Message']),
    JSON.parse
  )(snsEvent);
  return Api.persistEmailEvent(event)
    .then(() => callback(null, true))
    .catch(err => callback(err));
}
