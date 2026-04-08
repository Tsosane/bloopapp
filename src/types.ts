export type UserRole = 'admin' | 'donor';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
}

export interface DonorProfile {
  userId: string;
  bloodType: string;
  lastDonationDate?: string;
  isEligible: boolean;
  donationCount: number;
  location?: {
    latitude: number;
    longitude: number;
  };
  locationName?: string;
  phoneNumber?: string;
}

export interface BloodRequest {
  id: string;
  hospitalName: string;
  bloodType: string;
  quantity_ml: number;
  urgency: 'routine' | 'urgent' | 'emergency';
  status: 'pending' | 'processing' | 'fulfilled' | 'cancelled';
  patientName?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'emergency' | 'eligibility' | 'inventory' | 'system';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  createdAt: string;
}

export interface DonationAppointment {
  id: string;
  donorId: string;
  hospitalName: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface DonationFeedback {
  id?: string;
  appointmentId: string;
  donorId: string;
  donorName: string;
  hospitalName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface Message {
  id: number;
  sender_id: string;
  recipient_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}
