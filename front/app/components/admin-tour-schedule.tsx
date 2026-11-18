import { useState } from 'react';
import { durationLabel, formatTourRange, itineraryDayCount, maxItineraryDays, tourRange } from '@roniella/shared/tour-schedule';
import type { TripDetails } from '@roniella/shared/admin';

type Schedule = Pick<TripDetails, 'dates' | 'duration' | 'syncItinerary'>;
export function TourScheduleFields({ value, change }: { value: Schedule; change: (value: Schedule) => void }) {
  const existing = tourRange(value.dates);
  const [exact, setExact] = useState(!value.dates || Boolean(existing && existing.days <= maxItineraryDays));
  const [start, setStart] = useState(existing?.start ?? ''), [end, setEnd] = useState(existing?.end ?? '');
  const days = itineraryDayCount(value.dates, value.duration);
  function changeDates(first: string, last: string) {
    setStart(first); setEnd(last);
    const dates = first && last ? formatTourRange(first, last) : '';
    change({ ...value, dates });
  }
  return <fieldset className="admin-schedule"><legend>מועדים וימי המסלול / Tour dates and itinerary</legend>
    <label>סוג המועד / Date format <select value={exact ? 'exact' : 'note'} onChange={event => {
      const next = event.target.value === 'exact'; setExact(next);
      if (next) changeDates(start, end);
    }}><option value="exact">תאריכים מדויקים / Exact dates</option><option value="note">מועד משוער או הערה / Tentative dates or note</option></select></label>
    {exact ? <div className="admin-date-pair">
      <label>תאריך יציאה / Start date<input type="date" value={start} required={Boolean(end)} max={end || undefined} onChange={event => changeDates(event.target.value, end)} /></label>
      <label>תאריך חזרה / End date<input type="date" value={end} required={Boolean(start)} min={start || undefined} onChange={event => changeDates(start, event.target.value)} /></label>
    </div> : <label>מועדים / Travel dates or note<input value={value.dates} maxLength={2000} onChange={event => change({ ...value, dates: event.target.value })} /></label>}
    <label>משך הטיול / Duration in days<input value={value.syncItinerary && existing && existing.days <= maxItineraryDays ? durationLabel(existing.days) : value.duration}
      readOnly={Boolean(value.syncItinerary && existing && existing.days <= maxItineraryDays)} placeholder="7" maxLength={2000} onChange={event => change({ ...value, duration: event.target.value })} /></label>
    <label className="admin-checkbox"><input type="checkbox" checked={value.syncItinerary} onChange={event => change({ ...value, syncItinerary: event.target.checked })} />
      התאמת ימי המסלול למועדים / Match itinerary days to the dates</label>
    <p className="admin-field-hint">שני תאריכי הקצה נספרים. ללא טווח מדויק נשתמש במשך הטיול. ימים עודפים נשמרים, וימים חדשים מתחילים ריקים.
      <span lang="en" dir="ltr">Both dates count. With tentative dates, enter a duration. Shortening hides saved days. Extending restores them, then adds blank days.</span></p>
    {existing && existing.days > maxItineraryDays && <p role="status">בדקו את טווח התאריכים. לחישוב ישמש משך הטיול. / Check this unusually long range. The itinerary uses the duration.</p>}
    <output>{value.syncItinerary && days ? `ימי מסלול שיוצגו / Visible itinerary days · ${days}` : 'מספר הימים נקבע ידנית / The authored itinerary controls the count'}</output>
  </fieldset>;
}
