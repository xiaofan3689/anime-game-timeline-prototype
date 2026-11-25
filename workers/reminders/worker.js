import {runReminders} from '../../lib/email-reminders.js';
import {requireMailConfig,sendMail} from '../../lib/resend-mail.js';
export default {async scheduled(controller,env,ctx){requireMailConfig(env);await runReminders(env,sendMail)}};
