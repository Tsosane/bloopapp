import { DonorProfile, BloodRequest, DonationAppointment } from '../types';

const API_BASE = '/api';

export const api = {
  async getDonors() {
    const res = await fetch(`${API_BASE}/donors`);
    if (!res.ok) throw new Error('Failed to fetch donors');
    return res.json();
  },

  async getDonorProfile(uid: string) {
    const res = await fetch(`${API_BASE}/donors/${uid}`);
    if (!res.ok) throw new Error('Failed to fetch donor profile');
    return res.json();
  },

  async updateDonorProfile(uid: string, data: Partial<DonorProfile>) {
    const res = await fetch(`${API_BASE}/donors/${uid}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update donor profile');
    return res.json();
  },

  async getDonorAppointments(uid: string) {
    const res = await fetch(`${API_BASE}/appointments/donor/${uid}`);
    if (!res.ok) throw new Error('Failed to fetch appointments');
    return res.json();
  },

  async createAppointment(data: Partial<DonationAppointment>) {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create appointment');
    return res.json();
  },

  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },
  
  async getMessages(uid: string) {
    const res = await fetch(`${API_BASE}/messages/${uid}`);
    if (!res.ok) throw new Error('Failed to fetch messages');
    return res.json();
  },

  async sendMessage(data: { senderId: string, recipientId: string, content: string }) {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return res.json();
  }
};
