import { configureLogger } from '../../lib/index';
import respond from './action';

export default (event, context) => {
  configureLogger(event, context);
  respond(event, (error, response) => {
    return context.done(error, response);
  });
};
