import {runReminders} from '../../lib/email-reminders.js';
import {sendApplicationMail} from '../../lib/qq-smtp.js';
export default {async scheduled(controller,env,ctx){await runReminders(env,sendApplicationMail)}};
