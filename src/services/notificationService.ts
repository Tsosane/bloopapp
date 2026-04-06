import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BloodRequest, DonorProfile } from '../types';

export async function broadcastUrgentRequest(request: BloodRequest, hospitalName: string) {
  try {
    // 1. Find matching donors
    const donorsRef = collection(db, 'donors');
    const q = query(
      donorsRef, 
      where('bloodType', '==', request.bloodType),
      where('isEligible', '==', true)
    );
    
    const donorSnapshot = await getDocs(q);
    const notifications = [];

    for (const donorDoc of donorSnapshot.docs) {
      const donor = donorDoc.data() as DonorProfile;
      
      const urgencyLabel = request.urgency.toUpperCase();
      const priority = request.urgency === 'emergency' ? 'critical' : 'high';

      // 2. Create notification for each matching donor
      notifications.push(addDoc(collection(db, 'notifications'), {
        recipientId: donor.userId,
        title: `${urgencyLabel} BLOOD REQUEST: ${request.bloodType}`,
        message: `${hospitalName} has an ${request.urgency} request for ${request.bloodType} blood. Your immediate donation could save a life.`,
        type: 'emergency',
        priority: priority,
        isRead: false,
        createdAt: new Date().toISOString()
      }));
    }

    await Promise.all(notifications);
    console.log(`Broadcasted ${notifications.length} notifications for urgent request.`);
    return notifications.length;
  } catch (error) {
    console.error("Error broadcasting urgent request:", error);
    throw error;
  }
}
