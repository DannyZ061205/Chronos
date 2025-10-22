import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { usePopupStore } from '@/stores/popupStore';
import type { EventDraft } from '@/types';

export function EditForm() {
  const { eventDraft, setEventDraft, setUIState, uiState } = usePopupStore();
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [reminder, setReminder] = useState('60');
  const [description, setDescription] = useState('');
  const [repeatPattern, setRepeatPattern] = useState<string>('none');

  // Initialize form with current draft
  useEffect(() => {
    if (eventDraft) {
      setTitle(eventDraft.title);
      setDescription(eventDraft.description || '');

      // Parse recurrence pattern
      if (eventDraft.recurrence) {
        const freqMatch = eventDraft.recurrence.match(/FREQ=(\w+)/);
        if (freqMatch) {
          setRepeatPattern(freqMatch[1].toLowerCase());
        }
      } else {
        setRepeatPattern('none');
      }

      const dt = DateTime.fromISO(eventDraft.startISO);
      setDate(dt.toFormat('yyyy-MM-dd'));
      setTime(dt.toFormat('HH:mm'));

      const start = DateTime.fromISO(eventDraft.startISO);
      const end = DateTime.fromISO(eventDraft.endISO);
      const durationMins = end.diff(start, 'minutes').minutes;
      setDuration(Math.round(durationMins).toString());

      // Set reminder (default to 60 if not set)
      setReminder((eventDraft.reminderMinutes !== undefined ? eventDraft.reminderMinutes : 60).toString());
    }
  }, [eventDraft]);
  
  if (uiState !== 'editing') {
    return null;
  }
  
  const handleSave = () => {
    if (!eventDraft) return;
    
    // Parse the edited values
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    
    const startDT = DateTime.fromObject(
      { year, month, day, hour, minute },
      { zone: eventDraft.tz }
    );
    
    const endDT = startDT.plus({ minutes: parseInt(duration, 10) });
    
    // Generate RRULE based on pattern
    let rrule: string | undefined;
    if (repeatPattern !== 'none') {
      const freq = repeatPattern.toUpperCase();
      // Google Calendar RRULE format requires RRULE: prefix
      rrule = `RRULE:FREQ=${freq}`;
    }

    const updatedDraft: EventDraft = {
      title,
      startISO: startDT.toISO()!,
      endISO: endDT.toISO()!,
      tz: eventDraft.tz,
      description: description.trim() || undefined,
      recurrence: rrule,
      reminderMinutes: parseInt(reminder, 10),
    };
    
    setEventDraft(updatedDraft);
    setUIState('preview');
  };
  
  const handleCancel = () => {
    setUIState('preview');
  };
  
  return (
    <div className="card space-y-4">
      <h3 className="font-semibold text-lg text-gray-900">Edit Event</h3>
      
      <div className="space-y-3">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            placeholder="Event title"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input"
            />
          </div>
          
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
              Time
            </label>
            <input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
            Duration
          </label>
          <select
            id="duration"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="input"
          >
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15">15 minutes</option>
            <option value="20">20 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="75">1 hour 15 min</option>
            <option value="90">1.5 hours</option>
            <option value="105">1 hour 45 min</option>
            <option value="120">2 hours</option>
            <option value="150">2.5 hours</option>
            <option value="180">3 hours</option>
            <option value="210">3.5 hours</option>
            <option value="240">4 hours</option>
            <option value="300">5 hours</option>
            <option value="360">6 hours</option>
            <option value="480">8 hours</option>
            <option value="1440">All day (24 hours)</option>
          </select>
        </div>

        <div>
          <label htmlFor="reminder" className="block text-sm font-medium text-gray-700 mb-1">
            Reminder
          </label>
          <select
            id="reminder"
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className="input"
          >
            <option value="0">No reminder</option>
            <option value="5">5 minutes before</option>
            <option value="10">10 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="120">2 hours before</option>
            <option value="1440">1 day before</option>
          </select>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input resize-none"
            rows={3}
            placeholder="Add event details, location, agenda, etc."
          />
        </div>

        <div>
          <label htmlFor="repeat" className="block text-sm font-medium text-gray-700 mb-1">
            Repeat
          </label>
          <select
            id="repeat"
            value={repeatPattern}
            onChange={(e) => setRepeatPattern(e.target.value)}
            className="input"
          >
            <option value="none">Does not repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button onClick={handleSave} className="btn-primary flex-1">
          Save
        </button>
        <button onClick={handleCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}
