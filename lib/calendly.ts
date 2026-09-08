type CalendlyBooking = {
  eventUri: string;
  inviteeUri: string;
  cancelUrl: string | null;
  rescheduleUrl: string | null;
  meetingUrl: string | null;
};

async function calendlyRequest(path: string, init?: RequestInit) {
  const token = process.env.CALENDLY_ACCESS_TOKEN;
  if (!token) throw new Error('Calendly is not configured.');
  const response = await fetch(`https://api.calendly.com${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers },
  });
  const data = await response.json() as { resource?: Record<string, unknown>; message?: string; title?: string };
  if (!response.ok) throw new Error(data.message || data.title || `Calendly request failed (${response.status}).`);
  return data.resource || {};
}

export async function bookCalendlyConsultation(input: { name: string; email: string; startTime: string }): Promise<CalendlyBooking> {
  const eventType = process.env.CALENDLY_EVENT_TYPE_URI;
  if (!eventType) throw new Error('Calendly event type is not configured.');

  const resource = await calendlyRequest('/invitees', {
    method: 'POST',
    body: JSON.stringify({
      event_type: eventType,
      start_time: new Date(input.startTime).toISOString(),
      invitee: { name: input.name, email: input.email, timezone: 'Asia/Manila' },
    }),
  });
  const eventUri = String(resource.event || '');
  const eventId = eventUri.split('/').pop();
  let meetingUrl: string | null = null;
  if (eventId) {
    const event = await calendlyRequest(`/scheduled_events/${eventId}`);
    const location = event.location as { join_url?: string; location?: string } | undefined;
    meetingUrl = location?.join_url || location?.location || null;
  }

  return {
    eventUri,
    inviteeUri: String(resource.uri || ''),
    cancelUrl: typeof resource.cancel_url === 'string' ? resource.cancel_url : null,
    rescheduleUrl: typeof resource.reschedule_url === 'string' ? resource.reschedule_url : null,
    meetingUrl,
  };
}
