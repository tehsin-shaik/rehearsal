(()=>{
  let lastReport='',pendingCreate=false,pendingReply=false,pendingSlack=false,lastIssue='';let enabled=false;
  const emit=(sourceApplication,action,payload)=>{if(!enabled||document.querySelector('input[type="password"]'))return;void chrome.runtime.sendMessage({type:'EVENT',sourceApplication,action,payload}).catch(()=>{});};
  const safeField=element=>element&&!['password','hidden'].includes(element.type)&&!/password|secret|token|otp|pin|credit|card|cc-|one-time-code/i.test([element.name,element.autocomplete,element.getAttribute('aria-label')].join(' '));
  const poll=async()=>{try{const s=await chrome.runtime.sendMessage({type:'STATUS'});enabled=!!s.enabled;}catch{enabled=false;}};void poll();setInterval(()=>{void poll();},5000);
  const host=location.hostname;
  const observe=()=>{
    if(!enabled||document.querySelector('input[type="password"]'))return;
    if(host==='mail.google.com'){
      const thread=document.querySelector('[data-legacy-thread-id], [data-thread-perm-id]');const id=thread?.getAttribute('data-legacy-thread-id')??thread?.getAttribute('data-thread-perm-id');
      if(id&&id!==lastReport){lastReport=id;emit('mail','read_report',{reportId:id,subject:document.querySelector('h2.hP')?.textContent?.slice(0,500)??'',sender:document.querySelector('[email]')?.getAttribute('email')??''});}
      if(pendingReply&&[...document.querySelectorAll('[role="alert"]')].some(e=>/message sent/i.test(e.textContent??''))){pendingReply=false;emit('mail','reply_to_customer',{reportId:lastReport});}
    }
    if(host.endsWith('.atlassian.net')&&pendingCreate){const links=[...document.querySelectorAll('[role="alert"] a[href*="/browse/"], [data-testid*="flag"] a[href*="/browse/"]')];const link=links.at(-1);const key=link?.href.match(/\/browse\/([A-Z][A-Z0-9_]*-\d+)/)?.[1];if(key&&key!==lastIssue){pendingCreate=false;lastIssue=key;emit('issue_tracker','create_issue',{issueId:key,url:link.href});}}
    if(host==='app.clickup.com'&&pendingCreate){const link=[...document.querySelectorAll('[role="alert"] a[href*="/t/"], [data-test*="toast"] a[href*="/t/"]')].at(-1);if(link){pendingCreate=false;emit('issue_tracker','create_issue',{issueId:link.href.split('/t/')[1]?.split(/[?#]/)[0],url:link.href});}}
    if(host==='app.slack.com'&&pendingSlack){const latest=[...document.querySelectorAll('[data-message-id]')].at(-1);if(latest&&latest.getAttribute('data-message-id')!==pendingSlack){pendingSlack=false;emit('team_chat','send_team_notification',{channel:document.querySelector('[data-qa="channel_name"]')?.textContent?.slice(0,100)??'',issueId:latest.getAttribute('data-message-id')});}}
  };
  document.addEventListener('click',event=>{if(!enabled||document.querySelector('input[type="password"]'))return;const button=event.target.closest('button,[role="button"]');if(!button)return;const label=(button.getAttribute('aria-label')??button.getAttribute('data-tooltip')??button.textContent??'').trim();if(host.endsWith('.atlassian.net')||host==='app.clickup.com'){if(/^create(?: issue| task)?$/i.test(label)&&button.closest('[role="dialog"]'))pendingCreate=true;}if(host==='mail.google.com'&&/^send\b/i.test(label))pendingReply=true;if(host==='app.slack.com'&&/^send now|^send message/i.test(label)){pendingSlack=[...document.querySelectorAll('[data-message-id]')].at(-1)?.getAttribute('data-message-id')??'pending';}},true);
  document.addEventListener('change',event=>{if(!enabled||!safeField(event.target)||!host.endsWith('.atlassian.net'))return;const field=event.target;const label=field.getAttribute('aria-label')??field.name??'';if(/priority/i.test(label))emit('issue_tracker','classify_report',{severity:field.selectedOptions?.[0]?.textContent??field.value});if(/assignee/i.test(label))emit('issue_tracker','assign_owner',{owner:field.selectedOptions?.[0]?.textContent??field.value,issueId:lastIssue});},true);
  let timer;new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(observe,350);}).observe(document.documentElement,{childList:true,subtree:true});setInterval(observe,3000);
})();
