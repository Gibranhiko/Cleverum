import * as cron from 'node-cron';
import mongoose from 'mongoose';
import { adminDisabledUsers } from '../utils/globalState';
import ReminderModel, { IReminder } from '../models/Reminder.js';

// Hardcoded default time: 8:04 PM Mexico time (approximately 20:00)
const DEFAULT_REMINDER_TIME = { hour: 20, minute: 0 };

interface Reminder {
  id: string;
  message: string;
  phoneNumbers: string[];
  frequency: 'daily' | 'weekly' | 'monthly';
  time: { hour: number; minute: number }; // hour 8-21, minute 0 or 30
  active: boolean;
  createdAt: Date;
  lastSent?: Date;
}

class ReminderService {
  private provider: any = null;

  constructor() {
    // Init will be called publicly
  }

  public async init() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for reminders');
    await this.initializeCronJobs();
    // Log countdowns every 60 seconds for active reminders
    setInterval(async () => {
      const reminders = await this.getReminders();
      reminders.filter(r => r.active).forEach(reminder => this.logCountdown(reminder));
    }, 60000);
  }

  setProvider(provider: any) {
    this.provider = provider;
  }

  async getReminders(): Promise<Reminder[]> {
    const docs = await ReminderModel.find({});
    return docs.map(doc => ({
      id: doc.id,
      message: doc.message,
      phoneNumbers: doc.phoneNumbers,
      frequency: doc.frequency,
      time: doc.time,
      active: doc.active,
      createdAt: doc.createdAt,
      lastSent: doc.lastSent
    }));
  }

  private getCronExpression(reminder: Reminder): string {
    const { frequency, time } = reminder;
    const { hour, minute } = time;
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * 1-5`; // Mon-Fri at time
      case 'weekly':
        return `${minute} ${hour} * * 1`; // Every Monday at time
      case 'monthly':
        return `${minute} ${hour} 1 * *`; // 1st of month at time
      default:
        return `${minute} ${hour} * * 1-5`; // default daily
    }
  }

  private getNextExecutionTime(reminder: Reminder): Date {
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
  }

  private logCountdown(reminder: Reminder) {
    const nextTime = this.getNextExecutionTime(reminder);
    const now = new Date();
    const diffMs = nextTime.getTime() - now.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    const remainingSeconds = diffSeconds % 60;

    const timeStr = `${reminder.time.hour}:${reminder.time.minute.toString().padStart(2, '0')}`;
    console.log(`Reminder ${reminder.id} (${reminder.frequency} at ${timeStr}): Next execution in ${diffHours} hours ${remainingMinutes} minutes ${remainingSeconds} seconds`);
  }

  private async initializeCronJobs() {
    // Clear existing jobs and reinitialize
    // Note: In production, you'd want to manage cron jobs better
    const reminders = await this.getReminders();
    reminders.forEach(reminder => {
      const cronExpression = this.getCronExpression(reminder);
      if (reminder.active && cron.validate(cronExpression)) {
        cron.schedule(cronExpression, () => {
          this.sendReminder(reminder);
        }, {
          timezone: 'America/Mexico_City'
        });
        this.logCountdown(reminder);
      }
    });
  }

  private async sendReminder(reminder: Reminder) {
    if (!this.provider) {
      console.error('Provider not set for reminder service');
      return;
    }

    console.log(`Sending reminder ${reminder.id} to ${reminder.phoneNumbers.length} users`);

    for (const phone of reminder.phoneNumbers) {
      try {
        // Check if user has opted out
        if (adminDisabledUsers.has(phone)) {
          console.log(`Skipping reminder for opted-out user: ${phone}`);
          continue;
        }

        await this.provider.sendMessage(phone, reminder.message, {});
        console.log(`Reminder sent to ${phone}`);
      } catch (error) {
        console.error(`Failed to send reminder to ${phone}:`, error);
      }
    }

    await ReminderModel.findOneAndUpdate({ id: reminder.id }, { lastSent: new Date() });
    this.logCountdown(reminder);
  }

  async createReminder(message: string, phoneNumbers: string[], frequency: 'daily' | 'weekly' | 'monthly', time: { hour: number; minute: number }): Promise<Reminder> {
    const reminder: Reminder = {
      id: Date.now().toString(),
      message,
      phoneNumbers,
      frequency,
      time,
      active: true,
      createdAt: new Date()
    };

    const newDoc = new ReminderModel(reminder);
    await newDoc.save();

    // Schedule the cron job
    const cronExpression = this.getCronExpression(reminder);
    if (cron.validate(cronExpression)) {
      cron.schedule(cronExpression, () => {
        this.sendReminder(reminder);
      }, {
        timezone: 'America/Mexico_City'
      });
    }

    return reminder;
  }

  async updateReminder(id: string, updates: Partial<Reminder>): Promise<boolean> {
    const result = await ReminderModel.findOneAndUpdate({ id }, updates);
    return !!result;
  }

  async deleteReminder(id: string): Promise<boolean> {
    const result = await ReminderModel.findOneAndDelete({ id });
    return !!result;
  }

  importPhoneNumbers(csvData: string): string[] {
    // Simple CSV parser for phone numbers
    const lines = csvData.split('\n');
    const phones: string[] = [];

    for (const line of lines) {
      const phone = line.trim();
      if (phone && /^\+?\d+$/.test(phone)) {
        phones.push(phone);
      }
    }

    return phones;
  }
}

export default ReminderService;