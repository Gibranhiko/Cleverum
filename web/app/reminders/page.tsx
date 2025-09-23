"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/navbar";

interface Reminder {
  id: string;
  message: string;
  phoneNumbers: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  time: { hour: number; minute: number };
  active: boolean;
  createdAt: string;
  lastSent?: string;
}

export default function RemindersPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [message, setMessage] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<string[]>([]);
  const [manualPhone, setManualPhone] = useState("");
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [time, setTime] = useState<{ hour: number; minute: number }>({ hour: 20, minute: 0 });
  const [loading, setLoading] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<Set<string>>(new Set());
  const [countdowns, setCountdowns] = useState<{ [id: string]: string }>({});

  useEffect(() => {
    fetchReminders();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newCountdowns: { [id: string]: string } = {};
      reminders.forEach(reminder => {
        const nextTime = getNextExecutionTime(reminder);
        const diffMs = nextTime.getTime() - now.getTime();
        if (diffMs > 0) {
          const diffSeconds = Math.floor(diffMs / 1000);
          const diffMinutes = Math.floor(diffSeconds / 60);
          const diffHours = Math.floor(diffMinutes / 60);
          const remainingMinutes = diffMinutes % 60;
          const remainingSeconds = diffSeconds % 60;
          newCountdowns[reminder.id] = `${diffHours}h ${remainingMinutes}m ${remainingSeconds}s`;
        } else {
          newCountdowns[reminder.id] = 'Overdue';
        }
      });
      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [reminders]);

  const fetchReminders = async () => {
    try {
      const response = await fetch('/api/reminders');
      const data = await response.json();
      setReminders(data);
    } catch (error) {
      console.error('Error fetching reminders:', error);
    }
  };

  const getNextExecutionTime = (reminder: Reminder): Date => {
    const now = new Date();
    const { frequency, time } = reminder;
    let next = new Date(now);

    // Set to today at the specified time
    next.setHours(time.hour, time.minute, 0, 0);

    if (next <= now) {
      // If past, move to next occurrence
      switch (frequency) {
        case 'daily': {
          // Next weekday
          do {
            next.setDate(next.getDate() + 1);
          } while (next.getDay() === 0 || next.getDay() === 6); // Skip Sat/Sun
          break;
        }
        case 'weekly': {
          // Next Monday
          const daysUntilMonday = (1 - next.getDay() + 7) % 7 || 7;
          next.setDate(next.getDate() + daysUntilMonday);
          break;
        }
        case 'monthly': {
          // Next month 1st
          next.setMonth(next.getMonth() + 1, 1);
          break;
        }
      }
    } else {
      // If today is future, check if it matches frequency
      switch (frequency) {
        case 'daily': {
          if (next.getDay() === 0 || next.getDay() === 6) {
            // If weekend, move to next Monday
            const daysUntilMonday = (1 - next.getDay() + 7) % 7 || 7;
            next.setDate(next.getDate() + daysUntilMonday);
          }
          break;
        }
        case 'weekly': {
          if (next.getDay() !== 1) {
            // If not Monday, move to next Monday
            const daysUntilMonday = (1 - next.getDay() + 7) % 7 || 7;
            next.setDate(next.getDate() + daysUntilMonday);
          }
          break;
        }
        case 'monthly': {
          if (next.getDate() !== 1) {
            // If not 1st, move to next month 1st
            next.setMonth(next.getMonth() + 1, 1);
          }
          break;
        }
      }
    }

    return next;
  };

  const handleCreateReminder = async () => {
    if (!message.trim() || selectedPhones.size === 0) {
      alert("Please enter a message and select phone numbers");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          phoneNumbers: Array.from(selectedPhones),
          frequency,
          time
        })
      });

      if (response.ok) {
        setMessage("");
        setSelectedPhones(new Set());
        fetchReminders();
      } else {
        alert('Failed to create reminder');
      }
    } catch (error) {
      console.error('Error creating reminder:', error);
      alert('Error creating reminder');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPhone = () => {
    if (manualPhone.trim() && !phoneNumbers.includes(manualPhone.trim())) {
      setPhoneNumbers([...phoneNumbers, manualPhone.trim()]);
      setManualPhone("");
    }
  };

  const handleRemovePhone = (phone: string) => {
    setPhoneNumbers(phoneNumbers.filter(p => p !== phone));
    setSelectedPhones(prev => {
      const newSet = new Set(prev);
      newSet.delete(phone);
      return newSet;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/reminders/import', {
        method: 'POST',
        body: formData
      });

      const importedPhones: string[] = await response.json();
      const combined = [...phoneNumbers, ...importedPhones];
      setPhoneNumbers(Array.from(new Set(combined)));
    } catch (error) {
      console.error('Error importing phones:', error);
      alert('Error importing phone numbers');
    }
  };

  const togglePhoneSelection = (phone: string) => {
    setSelectedPhones(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phone)) {
        newSet.delete(phone);
      } else {
        newSet.add(phone);
      }
      return newSet;
    });
  };

  const deleteReminder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reminder?')) return;

    try {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      fetchReminders();
    } catch (error) {
      console.error('Error deleting reminder:', error);
      alert('Error deleting reminder');
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Reminder Management</h1>

        {/* Create Reminder Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Create New Reminder</h2>

          {/* Message Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Message (160 chars max)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 160))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Enter reminder message..."
            />
            <div className="text-sm text-gray-500 mt-1">{message.length}/160</div>
          </div>

          {/* Frequency and Time */}
          <div className="mb-4 grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="daily">Daily (Mon-Fri)</option>
                <option value="weekly">Weekly (Mondays)</option>
                <option value="monthly">Monthly (1st of month)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Hour</label>
              <select
                value={time.hour}
                onChange={(e) => setTime(prev => ({ ...prev, hour: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 14 }, (_, i) => i + 8).map(hour => (
                  <option key={hour} value={hour}>
                    {hour}:00 {hour < 12 ? 'AM' : 'PM'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Minute</label>
              <select
                value={time.minute}
                onChange={(e) => setTime(prev => ({ ...prev, minute: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>00</option>
                <option value={30}>30</option>
              </select>
            </div>
          </div>

          {/* Phone Numbers Management */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Phone Numbers</label>

            {/* Manual Add */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter phone number"
              />
              <button
                onClick={handleAddPhone}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>

            {/* File Upload */}
            <div className="mb-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <div className="text-sm text-gray-500 mt-1">Upload CSV file with phone numbers (one per line)</div>
            </div>

            {/* Phone List */}
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg">
              {phoneNumbers.map((phone, index) => (
                <div key={index} className="flex items-center justify-between p-2 border-b border-gray-200 last:border-b-0">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPhones.has(phone)}
                      onChange={() => togglePhoneSelection(phone)}
                      className="rounded"
                    />
                    <span>{phone}</span>
                  </div>
                  <button
                    onClick={() => handleRemovePhone(phone)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              Selected: {selectedPhones.size} of {phoneNumbers.length}
            </div>
          </div>

          <button
            onClick={handleCreateReminder}
            disabled={loading || !message.trim() || selectedPhones.size === 0}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Reminder'}
          </button>
        </div>

        {/* Existing Reminders */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Existing Reminders</h2>
          <div className="space-y-4">
            {reminders.map((reminder) => (
              <div key={reminder.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <p className="font-medium">{reminder.message}</p>
                    <p className="text-sm text-gray-600">Schedule: {reminder.frequency} at {reminder.time.hour}:{reminder.time.minute.toString().padStart(2, '0')}</p>
                    <p className="text-sm text-blue-600">Next execution: {countdowns[reminder.id] || 'Calculating...'}</p>
                    <p className="text-sm text-gray-600">Recipients: {reminder.phoneNumbers.length}</p>
                    <p className="text-sm text-gray-600">
                      Created: {new Date(reminder.createdAt).toLocaleString()}
                      {reminder.lastSent && ` | Last sent: ${new Date(reminder.lastSent).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2 py-1 rounded text-xs ${reminder.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {reminder.active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => deleteReminder(reminder.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {reminders.length === 0 && (
              <p className="text-gray-500 text-center py-8">No reminders created yet</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}