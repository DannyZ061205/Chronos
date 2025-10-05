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
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="45">45 minutes</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
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
