function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' })[character]!);
}

export async function sendHostlyEmail(input: { to:string; subject:string; heading:string; message:string; actionLabel?:string; actionUrl?:string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Email delivery is not configured.');
  const action = input.actionUrl ? `<p style="margin:28px 0"><a href="${escapeHtml(input.actionUrl)}" style="background:#0b2c52;color:white;padding:13px 20px;border-radius:999px;text-decoration:none;font-weight:700">${escapeHtml(input.actionLabel||'Continue')}</a></p>` : '';
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#102b49"><div style="font-size:22px;letter-spacing:.24em;font-weight:700;margin-bottom:28px">HOSTLY</div><div style="border:1px solid #d9e0e8;border-radius:16px;padding:32px"><p style="color:#536f8b;font-size:12px;letter-spacing:.12em;font-weight:700">YOUR PROPERTY DESERVES BETTER</p><h1 style="font-family:Georgia,serif;font-weight:400">${escapeHtml(input.heading)}</h1><p style="line-height:1.7;color:#64768a">${escapeHtml(input.message)}</p>${action}</div></div>`;
  const response = await fetch('https://api.resend.com/emails', { method:'POST', headers:{ authorization:`Bearer ${apiKey}`,'content-type':'application/json' }, body:JSON.stringify({ from, to:[input.to], subject:input.subject, html }) });
  const result = await response.json() as { id?:string; message?:string };
  if (!response.ok) throw new Error(result.message || `Email failed (${response.status}).`);
  return result.id;
}
