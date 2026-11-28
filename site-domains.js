(() => {
 const publicOrigins = ['https://xiaofan3689.top', 'https://www.xiaofan3689.top'];
 const opsOrigin = 'https://ops.xiaofan3689.top';
 const onPublicSite = publicOrigins.includes(location.origin);
 const actions = {
  '#open-application': 'apply-collaborator',
  '#open-feedback': 'site-feedback',
  '#open-email-reminders': 'site-email-reminders'
 };

 window.timelineSite = {
  onPublicSite,
  opsPath(path) { return onPublicSite ? opsOrigin + path : path; }
 };

 if (window.self !== window.top) return;
 if (onPublicSite) {
  document.querySelector('.top-actions .admin-link').href = opsOrigin + '/collaborator/';
  document.getElementById('apply-collaborator').onclick = () => {
   location.assign(opsOrigin + '/#open-application');
  };
 }
 if (location.origin === opsOrigin) {
  document.addEventListener('DOMContentLoaded', () => {
   if (!Object.hasOwn(actions, location.hash)) return;
   const button = document.getElementById(actions[location.hash]);
   if (!button) return;
   history.replaceState(history.state, '', location.pathname + location.search);
   button.click();
  }, {once:true});
 }
})();
