import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { BloodRequest, DonorProfile, HospitalProfile } from '../types';

// Helper to calculate distance in km between two points
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

export function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function broadcastUrgentRequest(request: BloodRequest, hospital: HospitalProfile) {
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
    const MAX_DISTANCE_KM = 50; // Broadcast to donors within 50km

    for (const donorDoc of donorSnapshot.docs) {
      const donor = donorDoc.data() as DonorProfile;
      
      // 2. Filter by distance if both have locations
      if (hospital.location && donor.location) {
        const distance = calculateDistance(
          hospital.location.latitude,
          hospital.location.longitude,
          donor.location.latitude,
          donor.location.longitude
        );
        
        if (distance > MAX_DISTANCE_KM) {
          continue; // Skip donors too far away
        }
      }
      
      const urgencyLabel = request.urgency.toUpperCase();
      const priority = request.urgency === 'emergency' ? 'critical' : 'high';

      // 3. Create notification for each matching donor
      notifications.push(addDoc(collection(db, 'notifications'), {
        recipientId: donor.userId,
        title: `${urgencyLabel} BLOOD REQUEST: ${request.bloodType}`,
        message: `${hospital.name} has an ${request.urgency} request for ${request.bloodType} blood. Your immediate donation could save a life.`,
        type: 'emergency',
        priority: priority,
        isRead: false,
        createdAt: new Date().toISOString(),
        metadata: {
          requestId: request.id,
          hospitalId: hospital.userId,
          hospitalName: hospital.name,
          bloodType: request.bloodType
        }
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
