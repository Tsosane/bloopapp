/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  Link, 
  useLocation,
  useNavigate
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  addDoc,
  updateDoc,
  Timestamp,
  limit,
  getDocs
} from 'firebase/firestore';
import { 
  Droplets, 
  LayoutDashboard, 
  History, 
  Bell, 
  User, 
  LogOut, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Calendar,
  Hospital as HospitalIcon,
  Activity,
  MapPin,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Star,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { format, differenceInDays, addDays, isAfter } from 'date-fns';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  UserProfile, 
  DonorProfile, 
  HospitalProfile, 
  BloodUnit, 
  BloodRequest, 
  Notification as AppNotification,
  UserRole,
  DonationFeedback,
  DonationAppointment
} from './types';
import { forecastBloodDemand } from './services/geminiService';
import { broadcastUrgentRequest } from './services/notificationService';

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  className = '', 
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost',
  className?: string,
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const baseStyles = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-red-600 text-white hover:bg-red-700 shadow-md hover:shadow-lg",
    secondary: "bg-gray-100 text-gray-900 hover:bg-gray-200",
    outline: "border-2 border-red-600 text-red-600 hover:bg-red-50",
    danger: "bg-red-100 text-red-700 hover:bg-red-200",
    ghost: "text-gray-600 hover:bg-gray-100"
  };

  return (
    <button 
      type={type}
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode, variant?: 'info' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    info: "bg-blue-50 text-blue-700 border-blue-100",
    success: "bg-green-50 text-green-700 border-green-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-red-50 text-red-700 border-red-100"
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[variant]}`}>
      {children}
    </span>
  );
};

const Toast = ({ message, type = 'success', isVisible, onClose }: { message: string, type?: 'success' | 'error', isVisible: boolean, onClose: () => void }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border ${
            type === 'success' ? 'bg-white border-green-100 text-green-700' : 'bg-white border-red-100 text-red-700'
          }`}
        >
          {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span className="font-semibold">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// --- Layout ---

const BottomNav = ({ role }: { role: UserRole | null }) => {
  const location = useLocation();
  const navItems = [
    { label: 'Home', path: '/', icon: LayoutDashboard, roles: ['admin', 'hospital', 'donor'] },
    { label: 'Inventory', path: '/inventory', icon: Droplets, roles: ['admin', 'hospital'] },
    { label: 'Requests', path: '/requests', icon: Activity, roles: ['admin', 'hospital'] },
    { label: 'Schedule', path: '/schedule', icon: Clock, roles: ['donor'] },
    { label: 'Profile', path: '/profile', icon: User, roles: ['donor'] },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => role && item.roles.includes(role)).slice(0, 4);

  if (!role) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-gray-100 z-50 pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {filteredItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
              location.pathname === item.path 
                ? 'text-red-600' 
                : 'text-gray-400'
            }`}
          >
            <item.icon className={`w-6 h-6 ${location.pathname === item.path ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

const Navbar = ({ user, role, onSignOut }: { user: FirebaseUser | null, role: UserRole | null, onSignOut: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'hospital', 'donor'] },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
    { label: 'Inventory', path: '/inventory', icon: Droplets, roles: ['admin', 'hospital'] },
    { label: 'Requests', path: '/requests', icon: Activity, roles: ['admin', 'hospital'] },
    { label: 'Donors', path: '/donors', icon: User, roles: ['admin', 'hospital'] },
    { label: 'Profile', path: '/profile', icon: User, roles: ['donor'] },
    { label: 'Schedule', path: '/schedule', icon: Clock, roles: ['donor'] },
    { label: 'History', path: '/history', icon: History, roles: ['donor'] },
    { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['admin', 'hospital', 'donor'] },
  ];

  const filteredItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-200">
                <Droplets className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Blood<span className="text-red-600">Suite</span></span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-4">
            {filteredItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === item.path 
                    ? 'text-red-600 bg-red-50' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            ))}
            {user && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-100">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-gray-900">{user.displayName}</p>
                  <p className="text-xs text-gray-500 capitalize">{role}</p>
                </div>
                <button onClick={onSignOut} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button - Hidden because we use BottomNav */}
          <div className="md:hidden flex items-center">
            <div className="flex items-center gap-3">
              {user && (
                <button onClick={onSignOut} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </nav>
  );
};

// --- Pages ---

const Login = () => {
  const [view, setView] = useState<'login' | 'register' | 'hospital_register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Registration form state
  const [regData, setRegData] = useState({
    fullName: '',
    phoneNumber: '',
    bloodType: 'O+',
    location: '',
    hospitalName: '',
    licenseNumber: '',
    address: ''
  });

  const handleGoogleLogin = async (isRegistration = false, role: UserRole = 'donor') => {
    if (isRegistration) {
      if (role === 'donor' && (!regData.fullName || !regData.phoneNumber)) {
        setError("Please fill in all required fields.");
        return;
      }
      if (role === 'hospital' && (!regData.hospitalName || !regData.licenseNumber || !regData.address)) {
        setError("Please fill in all hospital details.");
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (!userDoc.exists()) {
        // Create user profile
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          role: role,
          displayName: role === 'hospital' ? regData.hospitalName : (isRegistration ? regData.fullName : user.displayName),
          photoURL: user.photoURL,
          createdAt: new Date().toISOString()
        });

        if (role === 'donor') {
          // Create donor profile
          await setDoc(doc(db, 'donors', user.uid), {
            userId: user.uid,
            bloodType: isRegistration ? regData.bloodType : 'O+',
            phoneNumber: isRegistration ? regData.phoneNumber : '',
            locationName: isRegistration ? regData.location : '',
            isEligible: true,
            donationCount: 0,
            createdAt: new Date().toISOString()
          });
        } else if (role === 'hospital') {
          // Create hospital profile
          await setDoc(doc(db, 'hospitals', user.uid), {
            userId: user.uid,
            name: regData.hospitalName,
            licenseNumber: regData.licenseNumber,
            address: regData.address,
            isApproved: false, // Needs admin approval
            createdAt: new Date().toISOString()
          });
        }
      } else if (isRegistration) {
        setError("An account already exists for this email. Please sign in instead.");
        setView('login');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-gray-50">
      <Card className="max-w-md w-full p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-200 mx-auto mb-4">
            <Droplets className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {view === 'login' ? 'Welcome Back' : view === 'register' ? 'Join as Donor' : 'Register Hospital'}
          </h1>
          <p className="text-gray-500 mt-2">
            {view === 'login' ? 'Smart Blood Bank & Donor Management' : 'Help us save lives in Lesotho'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {view === 'login' ? (
          <div className="space-y-4">
            <Button 
              onClick={() => handleGoogleLogin(false)} 
              className="w-full py-3 text-lg" 
              disabled={loading}
            >
              <User className="w-5 h-5" />
              {loading ? 'Signing in...' : 'Sign in with Google'}
            </Button>
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">New to Blood Suite?</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={() => setView('register')} 
                className="py-3 text-sm"
                disabled={loading}
              >
                Donor Account
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setView('hospital_register')} 
                className="py-3 text-sm"
                disabled={loading}
              >
                Hospital Portal
              </Button>
            </div>
          </div>
        ) : view === 'register' ? (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleGoogleLogin(true, 'donor'); }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                placeholder="John Doe"
                value={regData.fullName}
                onChange={(e) => setRegData({...regData, fullName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input 
                type="tel" 
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                placeholder="+266 5800 0000"
                value={regData.phoneNumber}
                onChange={(e) => setRegData({...regData, phoneNumber: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type *</label>
                <select 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  value={regData.bloodType}
                  onChange={(e) => setRegData({...regData, bloodType: e.target.value})}
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Maseru"
                  value={regData.location}
                  onChange={(e) => setRegData({...regData, location: e.target.value})}
                />
              </div>
            </div>
            <Button 
              type="submit"
              className="w-full py-3 text-lg mt-4" 
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Register as Donor'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setView('login')} 
              className="w-full"
              disabled={loading}
            >
              Already have an account? Sign In
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleGoogleLogin(true, 'hospital'); }}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital Name *</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Maseru Central Hospital"
                value={regData.hospitalName}
                onChange={(e) => setRegData({...regData, hospitalName: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">License Number *</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="HOSP-12345"
                value={regData.licenseNumber}
                onChange={(e) => setRegData({...regData, licenseNumber: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="123 Kingsway, Maseru"
                value={regData.address}
                onChange={(e) => setRegData({...regData, address: e.target.value})}
              />
            </div>
            <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs">
              <p className="font-bold mb-1 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Verification Required</p>
              Hospital accounts must be verified by the Lesotho Blood Transfusion Services before accessing the inventory system.
            </div>
            <Button 
              type="submit"
              className="w-full py-3 text-lg mt-4" 
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Register Hospital'}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setView('login')} 
              className="w-full"
              disabled={loading}
            >
              Back to Sign In
            </Button>
          </form>
        )}
        
        <p className="text-xs text-center text-gray-400 mt-8">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </Card>
    </div>
  );
};


const DonorDashboard = ({ user, donorProfile }: { user: FirebaseUser, donorProfile: DonorProfile | null }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string, isVisible: boolean }>({ message: '', isVisible: false });

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  useEffect(() => {
    if (!user) return;
    
    // Fetch actual appointments for history
    const q = query(
      collection(db, 'appointments'),
      where('donorId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const notifQ = query(
      collection(db, 'notifications'), 
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribeNotif = onSnapshot(notifQ, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification)));
    });

    return () => {
      unsubscribe();
      unsubscribeNotif();
    };
  }, [user]);

  const daysSinceLastDonation = donorProfile?.lastDonationDate 
    ? differenceInDays(new Date(), new Date(donorProfile.lastDonationDate))
    : 100; // Default to eligible

  const isEligible = daysSinceLastDonation >= 56;
  const nextEligibleDate = donorProfile?.lastDonationDate 
    ? addDays(new Date(donorProfile.lastDonationDate), 56)
    : new Date();

  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const openFeedback = (appointment: any) => {
    setSelectedAppointment(appointment);
    setIsFeedbackModalOpen(true);
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      <Toast 
        message={toast.message} 
        isVisible={toast.isVisible} 
        onClose={() => setToast({ ...toast, isVisible: false })} 
      />

      {/* Feedback Modal */}
      <FeedbackModal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => setIsFeedbackModalOpen(false)} 
        appointment={selectedAppointment}
        user={user}
        onSuccess={showToast}
      />

      {/* Urgent Notifications Banner */}
      {notifications.filter(n => !n.isRead && (n.priority === 'critical' || n.priority === 'high')).map(n => (
        <motion.div 
          key={n.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={`p-4 rounded-xl shadow-lg flex items-center justify-between gap-4 ${
            n.priority === 'critical' ? 'bg-red-600' : 'bg-orange-500'
          } text-white`}
        >
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold">{n.title}</h3>
              <p className="text-sm text-red-100">{n.message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/schedule">
              <Button variant="secondary" className="bg-white text-red-600 hover:bg-red-50 text-sm py-1 px-3">
                Help Now
              </Button>
            </Link>
            <button onClick={() => markAsRead(n.id!)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ))}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hello, {user.displayName}!</h1>
          <p className="text-gray-500">Your blood type: <span className="font-bold text-red-600">{donorProfile?.bloodType || 'Not set'}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="p-2 text-gray-400 hover:text-red-600 transition-all md:hidden"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {isEligible ? (
            <Badge variant="success">Eligible to Donate</Badge>
          ) : (
            <Badge variant="warning">Next donation: {format(nextEligibleDate, 'MMM dd, yyyy')}</Badge>
          )}
        </div>
      </header>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-4 md:hidden">
        <Link to="/schedule" className="bg-red-600 p-4 rounded-2xl text-white shadow-lg shadow-red-200 flex flex-col items-center gap-2">
          <Calendar className="w-6 h-6" />
          <span className="text-sm font-bold">Schedule</span>
        </Link>
        <Link to="/profile" className="bg-white p-4 rounded-2xl text-gray-900 border border-gray-100 shadow-sm flex flex-col items-center gap-2">
          <User className="w-6 h-6 text-red-600" />
          <span className="text-sm font-bold">My Profile</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-red-600" />
              Recent Donations
            </h2>
            <Button variant="ghost" className="text-sm">View All</Button>
          </div>
          <div className="space-y-4">
            {history.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center">
                        <Droplets className="w-5 h-5 text-red-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.hospitalName}</p>
                        <p className="text-xs text-gray-500">{format(new Date(item.scheduledAt), 'MMMM dd, yyyy')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'danger' : 'info'}>
                        {item.status}
                      </Badge>
                      {item.status === 'completed' && (
                        <Button 
                          variant="ghost" 
                          className="text-xs text-red-600 hover:text-red-700"
                          onClick={() => openFeedback(item)}
                        >
                          Give Feedback
                        </Button>
                      )}
                    </div>
                  </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Donor Achievements
            </h3>
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                {donorProfile?.donationCount && donorProfile.donationCount >= 1 && (
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 border border-red-100 shadow-sm" title="First Drop">
                    <Droplets className="w-6 h-6" />
                  </div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 5 && (
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm" title="Life Saver">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 10 && (
                  <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-600 border border-yellow-100 shadow-sm" title="Hero">
                    <Star className="w-6 h-6" />
                  </div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 25 && (
                  <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm" title="Legend">
                    <Activity className="w-6 h-6" />
                  </div>
                )}
                {(!donorProfile?.donationCount || donorProfile.donationCount === 0) && (
                  <p className="text-sm text-gray-400 italic">Complete your first donation to earn badges!</p>
                )}
              </div>

              {donorProfile?.donationCount !== undefined && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                    <span>Next Milestone</span>
                    <span>{donorProfile.donationCount} / {donorProfile.donationCount < 1 ? 1 : donorProfile.donationCount < 5 ? 5 : donorProfile.donationCount < 10 ? 10 : 25}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(donorProfile.donationCount / (donorProfile.donationCount < 1 ? 1 : donorProfile.donationCount < 5 ? 5 : donorProfile.donationCount < 10 ? 10 : 25)) * 100}%` }}
                      className="h-full bg-red-600 rounded-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-600" />
                Notifications
              </h3>
              <button className="text-xs text-gray-400 hover:text-red-600">View All</button>
            </div>
            <div className="space-y-3">
              {notifications.length > 0 ? notifications.map(n => (
                <div key={n.id} className={`p-3 rounded-lg border-l-4 transition-all ${n.isRead ? 'bg-gray-50 border-gray-200' : 'bg-white border-red-500 shadow-sm'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <p className={`text-sm font-bold ${n.isRead ? 'text-gray-600' : 'text-gray-900'}`}>{n.title}</p>
                    {!n.isRead && <button onClick={() => markAsRead(n.id!)} className="text-[10px] text-red-600 font-bold hover:underline">Mark read</button>}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-2">{format(new Date(n.createdAt), 'MMM dd, HH:mm')}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-400 text-center py-8">No new alerts</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-red-600 to-red-700 text-white border-none">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Ready to save a life?</h2>
            {isEligible ? (
              <p className="text-red-100">There is currently a high demand for {donorProfile?.bloodType} blood in Maseru.</p>
            ) : (
              <p className="text-red-100">You will be eligible to donate again on {format(nextEligibleDate, 'MMMM dd, yyyy')}.</p>
            )}
          </div>
          <Link to={isEligible ? "/schedule" : "#"}>
            <Button 
              variant="secondary" 
              className={`bg-white text-red-600 hover:bg-red-50 px-8 py-3 text-lg ${!isEligible ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!isEligible}
            >
              Schedule Donation
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

const ScheduleDonationPage = ({ user, donorProfile }: { user: FirebaseUser, donorProfile: DonorProfile | null }) => {
  const [hospitals, setHospitals] = useState<HospitalProfile[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [date, setDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>('09:00');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const q = query(collection(db, 'hospitals'), where('isApproved', '==', true));
        const snapshot = await getDocs(q);
        setHospitals(snapshot.docs.map(doc => doc.data() as HospitalProfile));
      } catch (err) {
        console.error("Error fetching hospitals:", err);
      }
    };
    fetchHospitals();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospital) {
      setError("Please select a blood bank.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const hospital = hospitals.find(h => h.userId === selectedHospital);
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      
      await addDoc(collection(db, 'appointments'), {
        donorId: user.uid,
        hospitalId: selectedHospital,
        hospitalName: hospital?.name || 'Unknown Hospital',
        scheduledAt,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      });

      // Create notification for the donor
      await addDoc(collection(db, 'notifications'), {
        recipientId: user.uid,
        title: 'Donation Scheduled',
        message: `Your donation at ${hospital?.name} is scheduled for ${format(new Date(scheduledAt), 'MMMM dd')} at ${time}.`,
        type: 'system',
        priority: 'medium',
        isRead: false,
        createdAt: new Date().toISOString()
      });
      
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Donation Scheduled!</h1>
        <p className="text-gray-600 mb-8">
          Thank you for your commitment. Your appointment has been successfully booked.
        </p>
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm mb-8 text-left">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium">{format(new Date(date), 'MMMM dd, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{time}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Location</span>
              <span className="font-medium">{hospitals.find(h => h.userId === selectedHospital)?.name}</span>
            </div>
          </div>
        </div>
        <Link to="/">
          <Button variant="outline" className="w-full">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const daysSinceLastDonation = donorProfile?.lastDonationDate 
    ? differenceInDays(new Date(), new Date(donorProfile.lastDonationDate))
    : 100;

  const isEligible = daysSinceLastDonation >= 56;

  if (!isEligible) {
    const nextEligibleDate = donorProfile?.lastDonationDate 
      ? addDays(new Date(donorProfile.lastDonationDate), 56)
      : new Date();

    return (
      <div className="max-w-md mx-auto py-12">
        <Card className="text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Not Eligible Yet</h2>
          <p className="text-gray-600 mb-6">
            You must wait at least 56 days between donations. You will be eligible again on 
            <span className="font-bold text-red-600"> {format(nextEligibleDate, 'MMMM dd, yyyy')}</span>.
          </p>
          <Link to="/">
            <Button variant="primary" className="w-full">Back to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Schedule a Donation</h1>
        <p className="text-gray-500">Choose a convenient time and location to save a life.</p>
      </header>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <HospitalIcon className="w-4 h-4 text-red-600" />
                Select Blood Bank / Hospital
              </label>
              <select 
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
              >
                <option value="">Choose a location...</option>
                {hospitals.length > 0 ? hospitals.map(hospital => (
                  <option key={hospital.userId} value={hospital.userId}>
                    {hospital.name} - {hospital.address}
                  </option>
                )) : (
                  <option disabled>No approved hospitals found</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  Preferred Date
                </label>
                <input 
                  type="date" 
                  required
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-red-600" />
                  Preferred Time
                </label>
                <select 
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                >
                  {['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-4 bg-red-50 rounded-xl flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-bold">Important Reminders:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Eat a healthy meal before donating.</li>
                <li>Drink plenty of water.</li>
                <li>Bring a valid ID.</li>
                <li>Ensure you have had enough sleep.</li>
              </ul>
            </div>
          </div>

          <Button type="submit" className="w-full py-4 text-lg" disabled={loading}>
            {loading ? 'Scheduling...' : 'Confirm Appointment'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

const DonorProfilePage = ({ user, donorProfile, onUpdate }: { user: FirebaseUser, donorProfile: DonorProfile | null, onUpdate: (data: Partial<DonorProfile>) => Promise<void> }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phoneNumber: donorProfile?.phoneNumber || '',
    locationName: donorProfile?.locationName || ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Update failed", error);
    } finally {
      setLoading(false);
    }
  };

  const daysSinceLastDonation = donorProfile?.lastDonationDate 
    ? differenceInDays(new Date(), new Date(donorProfile.lastDonationDate))
    : 100;

  const isEligible = daysSinceLastDonation >= 56;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <Button 
          variant={isEditing ? 'ghost' : 'outline'} 
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </header>

      <Card className="overflow-hidden">
        <div className="bg-red-600 h-24 -mx-6 -mt-6 mb-12 relative">
          <div className="absolute -bottom-10 left-6">
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center border-4 border-white">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full rounded-xl object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-10 h-10 text-gray-300" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.displayName}</h2>
            <p className="text-gray-500">{user.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Blood Type</p>
              <p className="text-2xl font-black text-red-600">{donorProfile?.bloodType}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Status</p>
              <Badge variant={isEligible ? 'success' : 'warning'}>
                {isEligible ? 'Eligible' : 'Ineligible'}
              </Badge>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t border-gray-100">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
                  value={formData.locationName}
                  onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-3 text-gray-600">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>{donorProfile?.locationName || 'No location set'}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <Activity className="w-5 h-5 text-gray-400" />
                <span>{donorProfile?.phoneNumber || 'No phone number set'}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <History className="w-5 h-5 text-gray-400" />
                <span>{donorProfile?.donationCount || 0} Total Donations</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="md:hidden pt-4">
        <Button 
          variant="danger" 
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-100"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>

      <Card>
        <h3 className="text-lg font-bold mb-4">Donation Eligibility</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Last Donation</span>
            <span className="font-medium">{donorProfile?.lastDonationDate ? format(new Date(donorProfile.lastDonationDate), 'MMM dd, yyyy') : 'Never'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Next Eligible Date</span>
            <span className="font-medium text-red-600">
              {donorProfile?.lastDonationDate 
                ? format(addDays(new Date(donorProfile.lastDonationDate), 56), 'MMM dd, yyyy')
                : 'Now'}
            </span>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg flex gap-3">
            <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0" />
            <p className="text-sm text-blue-800">
              Donors must wait at least 56 days between whole blood donations to ensure their own health and the quality of the blood.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

import { broadcastUrgentRequest } from './services/notificationService';

// --- Feedback Components ---

const FeedbackModal = ({ isOpen, onClose, appointment, user, onSuccess }: { isOpen: boolean, onClose: () => void, appointment: any, user: FirebaseUser, onSuccess: (msg: string) => void }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'feedbacks'), {
        appointmentId: appointment.id,
        donorId: user.uid,
        donorName: user.displayName || 'Anonymous',
        hospitalId: appointment.hospitalId,
        hospitalName: appointment.hospitalName,
        rating,
        comment,
        createdAt: new Date().toISOString()
      });
      onSuccess("Thank you for your feedback!");
      onClose();
      setComment('');
      setRating(5);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white rounded-t-[2rem] md:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pb-8 md:pb-0"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold">Donation Feedback</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">How was your experience at <span className="font-bold">{appointment?.hospitalName}</span>?</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className={`p-2 transition-all ${rating >= star ? 'text-yellow-400' : 'text-gray-200'}`}
                    >
                      <Star className={`w-8 h-8 ${rating >= star ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Comments</label>
                <textarea 
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none min-h-[120px] transition-all"
                  placeholder="Tell us about the staff, facility, or process..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full py-3" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </Button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const DonorDirectory = () => {
  const [donors, setDonors] = useState<(DonorProfile & { displayName: string, email: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('All');

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        const donorsSnap = await getDocs(collection(db, 'donors'));
        const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'donor')));
        
        const usersMap = new Map();
        usersSnap.forEach(doc => {
          usersMap.set(doc.id, doc.data());
        });

        const mergedData = donorsSnap.docs.map(doc => {
          const donorData = doc.data() as DonorProfile;
          const userData = usersMap.get(donorData.userId);
          return {
            ...donorData,
            displayName: userData?.displayName || 'Anonymous',
            email: userData?.email || 'N/A'
          };
        });

        setDonors(mergedData);
      } catch (error) {
        console.error("Error fetching donors:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDonors();
  }, []);

  const filteredDonors = donors.filter(donor => {
    const matchesSearch = 
      donor.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donor.locationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donor.bloodType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBloodType = bloodTypeFilter === 'All' || donor.bloodType === bloodTypeFilter;
    
    return matchesSearch && matchesBloodType;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donor Directory</h1>
          <p className="text-gray-500">Search and manage the donor network</p>
        </div>
      </header>

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search by name, location, or blood type..." 
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <select 
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
              value={bloodTypeFilter}
              onChange={(e) => setBloodTypeFilter(e.target.value)}
            >
              <option value="All">All Blood Types</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDonors.map(donor => (
            <div key={donor.userId}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 font-bold text-lg shrink-0">
                    {donor.bloodType}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{donor.displayName}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 shrink-0" /> {donor.locationName || 'Location not set'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Donations: <span className="font-semibold text-gray-900">{donor.donationCount}</span>
                    </p>
                    <div className="mt-4 flex items-center gap-2">
                      <Badge variant={donor.isEligible ? 'success' : 'danger'}>
                        {donor.isEligible ? 'Eligible' : 'Ineligible'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
          {filteredDonors.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No donors found matching your criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const [feedbacks, setFeedbacks] = useState<DonationFeedback[]>([]);
  const [pendingHospitals, setPendingHospitals] = useState<HospitalProfile[]>([]);
  const [stats, setStats] = useState({
    totalDonors: 0,
    totalHospitals: 0,
    totalDonations: 0,
    avgRating: 0
  });

  useEffect(() => {
    const unsubFeedbacks = onSnapshot(query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'), limit(50)), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DonationFeedback));
      setFeedbacks(data);
      
      if (data.length > 0) {
        const sum = data.reduce((acc, f) => acc + f.rating, 0);
        setStats(prev => ({ ...prev, avgRating: sum / data.length }));
      }
    });

    const unsubHospitals = onSnapshot(query(collection(db, 'hospitals'), where('isApproved', '==', false)), (snapshot) => {
      setPendingHospitals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as HospitalProfile)));
    });

    // Fetch other stats
    const fetchStats = async () => {
      const donors = await getDocs(collection(db, 'donors'));
      const hospitals = await getDocs(collection(db, 'hospitals'));
      const appointments = await getDocs(query(collection(db, 'appointments'), where('status', '==', 'completed')));
      
      setStats(prev => ({
        ...prev,
        totalDonors: donors.size,
        totalHospitals: hospitals.size,
        totalDonations: appointments.size
      }));
    };
    fetchStats();

    return () => { unsubFeedbacks(); unsubHospitals(); };
  }, []);

  const approveHospital = async (hospitalId: string) => {
    try {
      await updateDoc(doc(db, 'hospitals', hospitalId), { isApproved: true });
    } catch (error) {
      console.error("Error approving hospital:", error);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
        <p className="text-gray-500">Overview of Blood Suite operations and donor feedback</p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left">
            <div className="bg-red-50 p-2 md:p-3 rounded-xl text-red-600">
              <User className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-500 uppercase tracking-wider font-bold">Donors</p>
              <p className="text-xl md:text-2xl font-bold">{stats.totalDonors}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left">
            <div className="bg-blue-50 p-2 md:p-3 rounded-xl text-blue-600">
              <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-500 uppercase tracking-wider font-bold">Hospitals</p>
              <p className="text-xl md:text-2xl font-bold">{stats.totalHospitals}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left">
            <div className="bg-green-50 p-2 md:p-3 rounded-xl text-green-600">
              <Droplets className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-500 uppercase tracking-wider font-bold">Donations</p>
              <p className="text-xl md:text-2xl font-bold">{stats.totalDonations}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 md:p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-4 text-center md:text-left">
            <div className="bg-yellow-50 p-2 md:p-3 rounded-xl text-yellow-600">
              <Star className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-500 uppercase tracking-wider font-bold">Rating</p>
              <p className="text-xl md:text-2xl font-bold">{stats.avgRating.toFixed(1)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pending Approvals */}
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-600" />
              Pending Hospital Approvals
            </h2>
            <Badge variant={pendingHospitals.length > 0 ? 'warning' : 'success'}>
              {pendingHospitals.length} Pending
            </Badge>
          </div>
          <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
            {pendingHospitals.length > 0 ? pendingHospitals.map(hospital => (
              <div key={hospital.userId} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div>
                  <h3 className="font-bold text-gray-900">{hospital.name}</h3>
                  <p className="text-sm text-gray-500">{hospital.address}</p>
                  <p className="text-xs text-gray-400 mt-1">License: {hospital.licenseNumber}</p>
                </div>
                <Button variant="outline" className="text-xs py-1 px-3 h-auto" onClick={() => approveHospital(hospital.userId)}>
                  Approve
                </Button>
              </div>
            )) : (
              <div className="p-12 text-center text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>All hospitals are approved.</p>
              </div>
            )}
          </div>
        </Card>

        {/* Recent Donor Feedback */}
        <Card className="p-0 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold">Recent Donor Feedback</h2>
          </div>
          <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto">
            {feedbacks.length > 0 ? feedbacks.map((f) => (
            <div key={f.id} className="p-4 rounded-xl border border-gray-100 hover:border-red-100 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                    {f.donorName[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{f.donorName}</p>
                    <p className="text-xs text-gray-500">at {f.hospitalName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} className={`w-4 h-4 ${f.rating >= s ? 'text-yellow-400 fill-current' : 'text-gray-200'}`} />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 text-sm italic">"{f.comment}"</p>
              <p className="text-[10px] text-gray-400 mt-3">{format(new Date(f.createdAt), 'MMM dd, yyyy • HH:mm')}</p>
            </div>
          )) : (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No feedback received yet.</p>
            </div>
          )}
        </div>
      </Card>
    </div>

    <div className="md:hidden pt-4">
        <Button 
          variant="danger" 
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-100"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const HospitalDashboard = ({ user, hospitalProfile }: { user: FirebaseUser, hospitalProfile: HospitalProfile | null }) => {
  const [inventory, setInventory] = useState<BloodUnit[]>([]);
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [appointments, setAppointments] = useState<(DonationAppointment & { donorName?: string })[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newRequest, setNewRequest] = useState({
    bloodType: 'O+',
    urgency: 'routine' as 'routine' | 'urgent' | 'emergency',
    patientName: '',
    quantity_ml: 450
  });
  const [newStock, setNewStock] = useState({
    bloodType: 'O+',
    quantity_ml: 450,
    expiryDate: format(addDays(new Date(), 35), 'yyyy-MM-dd')
  });
  const [submitting, setSubmitting] = useState(false);

  const getForecast = async () => {
    if (!hospitalProfile) return;
    setRefreshing(true);
    const data = await forecastBloodDemand(requests.slice(0, 20), hospitalProfile.name);
    setForecast(data);
    setRefreshing(false);
  };

  useEffect(() => {
    if (!hospitalProfile) return;

    const invQuery = query(collection(db, 'inventory'), where('hospitalId', '==', hospitalProfile.userId));
    const reqQuery = query(collection(db, 'requests'), where('hospitalId', '==', hospitalProfile.userId), orderBy('createdAt', 'desc'), limit(10));
    const appQuery = query(collection(db, 'appointments'), where('hospitalId', '==', hospitalProfile.userId), where('status', '==', 'scheduled'), orderBy('scheduledAt', 'asc'));

    const unsubInv = onSnapshot(invQuery, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BloodUnit)));
    });

    const unsubReq = onSnapshot(reqQuery, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BloodRequest)));
    });

    const unsubApp = onSnapshot(appQuery, async (snapshot) => {
      const appData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DonationAppointment));
      
      // Fetch donor names
      const appsWithNames = await Promise.all(appData.map(async (app) => {
        const donorDoc = await getDoc(doc(db, 'users', app.donorId));
        return { ...app, donorName: donorDoc.exists() ? donorDoc.data().displayName : 'Unknown Donor' };
      }));
      
      setAppointments(appsWithNames);
    });

    getForecast();

    return () => { unsubInv(); unsubReq(); unsubApp(); };
  }, [hospitalProfile]);

  useEffect(() => {
    if (requests.length > 0 && forecast.length === 0) {
      getForecast();
    }
  }, [requests]);

  const handleCompleteDonation = async (appointmentId: string, donorId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), { status: 'completed' });
      // Increment donor's donation count
      const donorRef = doc(db, 'donors', donorId);
      const donorSnap = await getDoc(donorRef);
      if (donorSnap.exists()) {
        await updateDoc(donorRef, { 
          donationCount: (donorSnap.data().donationCount || 0) + 1,
          lastDonationDate: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error("Error completing donation:", error);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalProfile) return;
    
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'inventory'), {
        hospitalId: hospitalProfile.userId,
        ...newStock,
        status: 'available',
        createdAt: new Date().toISOString()
      });
      setIsStockModalOpen(false);
      setNewStock({ bloodType: 'O+', quantity_ml: 450, expiryDate: format(addDays(new Date(), 35), 'yyyy-MM-dd') });
    } catch (error) {
      console.error("Error adding stock:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospitalProfile) return;
    
    setSubmitting(true);
    try {
      const requestData = {
        hospitalId: hospitalProfile.userId,
        ...newRequest,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'requests'), requestData);
      
      // If urgent or emergency, broadcast to donors
      if (newRequest.urgency !== 'routine') {
        await broadcastUrgentRequest({ id: docRef.id, ...requestData } as BloodRequest, hospitalProfile.name);
      }
      
      setIsModalOpen(false);
      setNewRequest({ bloodType: 'O+', urgency: 'routine', patientName: '', quantity_ml: 450 });
    } catch (error) {
      console.error("Error creating request:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const stockByType = inventory.reduce((acc: any, unit) => {
    acc[unit.bloodType] = (acc[unit.bloodType] || 0) + unit.quantity_ml;
    return acc;
  }, {});

  const chartData = Object.keys(stockByType).map(type => ({
    name: type,
    value: stockByType[type] / 1000 // Convert to Liters
  }));

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hospitalProfile?.name}</h1>
          <p className="text-gray-500">Hospital Dashboard • {hospitalProfile?.address}</p>
        </div>
        <div className="hidden md:flex gap-2">
          <Button variant="outline" onClick={() => setIsStockModalOpen(true)}><Plus className="w-4 h-4" /> Add Stock</Button>
          <Button onClick={() => setIsModalOpen(true)}><Activity className="w-4 h-4" /> New Request</Button>
        </div>
      </header>

      {/* Quick Actions - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-4 md:hidden">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 p-4 rounded-2xl text-white shadow-lg shadow-red-200 flex flex-col items-center gap-2"
        >
          <Plus className="w-6 h-6" />
          <span className="text-sm font-bold">New Request</span>
        </button>
        <button 
          onClick={() => setIsStockModalOpen(true)}
          className="bg-white p-4 rounded-2xl text-gray-900 border border-gray-100 shadow-sm flex flex-col items-center gap-2"
        >
          <Droplets className="w-6 h-6 text-red-600" />
          <span className="text-sm font-bold">Add Stock</span>
        </button>
      </div>

      {/* Add Stock Modal */}
      <AnimatePresence>
        {isStockModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white rounded-t-[2rem] md:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pb-8 md:pb-0"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold">Add Blood Stock</h2>
                <button onClick={() => setIsStockModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddStock} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                      value={newStock.bloodType}
                      onChange={(e) => setNewStock({...newStock, bloodType: e.target.value})}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (ml)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                      value={newStock.quantity_ml}
                      onChange={(e) => setNewStock({...newStock, quantity_ml: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                    value={newStock.expiryDate}
                    onChange={(e) => setNewStock({...newStock, expiryDate: e.target.value})}
                  />
                </div>
                <Button type="submit" className="w-full py-3" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add to Inventory'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white rounded-t-[2rem] md:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pb-8 md:pb-0"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 mb-1 md:hidden" />
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold">Create Blood Request</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name (Optional)</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                    placeholder="e.g. John Doe"
                    value={newRequest.patientName}
                    onChange={(e) => setNewRequest({...newRequest, patientName: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
                    <select 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                      value={newRequest.bloodType}
                      onChange={(e) => setNewRequest({...newRequest, bloodType: e.target.value})}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity (ml)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                      value={newRequest.quantity_ml}
                      onChange={(e) => setNewRequest({...newRequest, quantity_ml: parseInt(e.target.value)})}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['routine', 'urgent', 'emergency'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setNewRequest({...newRequest, urgency: level as any})}
                        className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                          newRequest.urgency === level 
                            ? 'bg-red-600 border-red-600 text-white shadow-md' 
                            : 'bg-white border-gray-200 text-gray-500 hover:border-red-200'
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
                {newRequest.urgency !== 'routine' && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs flex gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <p>Selecting <strong>{newRequest.urgency}</strong> will automatically notify all eligible <strong>{newRequest.bloodType}</strong> donors in the system.</p>
                  </div>
                )}
                <Button type="submit" className="w-full py-3" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Submit Request'}
                </Button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Low Stock Alerts */}
      {inventory.length > 0 && ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(type => {
        const count = inventory.filter(i => i.bloodType === type).length;
        if (count < 3) {
          return (
            <motion.div 
              key={type}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center gap-3 text-orange-800"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-sm">
                <span className="font-bold">Low Stock Alert:</span> {type} inventory is low ({count} units). Consider broadcasting a request.
              </div>
            </motion.div>
          );
        }
        return null;
      })}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Upcoming Appointments */}
          <Card className="p-0 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-red-600" />
                Upcoming Appointments
              </h2>
              <Badge variant="info">{appointments.length} Scheduled</Badge>
            </div>
            <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
              {appointments.length > 0 ? appointments.map(app => (
                <div key={app.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-red-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{app.donorName}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(app.scheduledAt), 'MMM dd, yyyy • HH:mm')}
                      </p>
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    className="text-xs py-1 px-3 h-auto border-green-200 text-green-700 hover:bg-green-50"
                    onClick={() => handleCompleteDonation(app.id!, app.donorId)}
                  >
                    Mark Donated
                  </Button>
                </div>
              )) : (
                <div className="p-12 text-center text-gray-400">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No appointments scheduled for today.</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-6">Inventory Levels (Liters)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-6 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-red-600" />
              AI Demand Forecast
            </div>
            <button 
              onClick={getForecast} 
              disabled={refreshing}
              className={`p-2 text-gray-400 hover:text-red-600 transition-all ${refreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </h2>
          <div className="space-y-4">
            {forecast.length > 0 ? forecast.map((f, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700">{f.bloodType}</span>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600">+{f.forecastedQuantity} units</p>
                    <p className="text-[10px] text-gray-500 uppercase">Next 7 days</p>
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex gap-2">
                  <div className="w-1 h-auto bg-red-400 rounded-full shrink-0" />
                  <p className="text-[11px] text-gray-600 leading-relaxed italic">
                    {f.insight}
                  </p>
                </div>
              </div>
            )) : (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg"></div>)}
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-6">Recent Blood Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-sm border-b border-gray-100">
                <th className="pb-4 font-medium">Patient / ID</th>
                <th className="pb-4 font-medium">Blood Type</th>
                <th className="pb-4 font-medium">Urgency</th>
                <th className="pb-4 font-medium">Status</th>
                <th className="pb-4 font-medium">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4">
                    <p className="font-medium text-gray-900">{req.patientName || 'Emergency'}</p>
                    <p className="text-xs text-gray-500">REQ-{req.id.slice(0,6)}</p>
                  </td>
                  <td className="py-4 font-bold text-red-600">{req.bloodType}</td>
                  <td className="py-4">
                    <div className="flex flex-col gap-1">
                      <Badge variant={req.urgency === 'emergency' ? 'danger' : req.urgency === 'urgent' ? 'warning' : 'info'}>
                        {req.urgency}
                      </Badge>
                      {req.urgency !== 'routine' && (
                        <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin-slow" />
                          BROADCASTED
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        req.status === 'fulfilled' ? 'bg-green-500' : req.status === 'pending' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm capitalize">{req.status}</span>
                    </div>
                  </td>
                  <td className="py-4 text-sm text-gray-500">
                    {format(new Date(req.createdAt), 'MMM dd, HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="md:hidden pt-4">
        <Button 
          variant="danger" 
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-red-100"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
  const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        try {
          // Fetch profile
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setUserProfile(profile);

            if (profile.role === 'donor') {
              const donorDoc = await getDoc(doc(db, 'donors', firebaseUser.uid));
              if (donorDoc.exists()) setDonorProfile(donorDoc.data() as DonorProfile);
            } else if (profile.role === 'hospital') {
              const hospitalDoc = await getDoc(doc(db, 'hospitals', firebaseUser.uid));
              if (hospitalDoc.exists()) setHospitalProfile(hospitalDoc.data() as HospitalProfile);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUserProfile(null);
        setDonorProfile(null);
        setHospitalProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = () => signOut(auth);

  const handleUpdateDonorProfile = async (data: Partial<DonorProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'donors', user.uid), data);
      setDonorProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `donors/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center shadow-xl shadow-red-200"
        >
          <Droplets className="text-white w-10 h-10" />
        </motion.div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        {!user ? (
          <Login />
        ) : (
          <>
            <Navbar user={user} role={userProfile?.role || null} onSignOut={handleSignOut} />
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Routes location={location}>
                    <Route path="/" element={
                      userProfile?.role === 'donor' ? (
                        <DonorDashboard user={user} donorProfile={donorProfile} />
                      ) : userProfile?.role === 'hospital' ? (
                        <HospitalDashboard user={user} hospitalProfile={hospitalProfile} />
                      ) : userProfile?.role === 'admin' ? (
                        <AdminDashboard />
                      ) : (
                        <div className="text-center py-20">
                          <HospitalIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                          <h2 className="text-xl font-semibold">Loading Dashboard...</h2>
                        </div>
                      )
                    } />
                    <Route path="/admin" element={
                      userProfile?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />
                    } />
                    <Route path="/profile" element={
                      userProfile?.role === 'donor' ? (
                        <DonorProfilePage user={user} donorProfile={donorProfile} onUpdate={handleUpdateDonorProfile} />
                      ) : <Navigate to="/" />
                    } />
                    <Route path="/schedule" element={
                      userProfile?.role === 'donor' ? (
                        <ScheduleDonationPage user={user} donorProfile={donorProfile} />
                      ) : <Navigate to="/" />
                    } />
                    <Route path="/inventory" element={<div className="p-8 text-center">Inventory Management Module</div>} />
                    <Route path="/requests" element={<div className="p-8 text-center">Blood Requests Module</div>} />
                    <Route path="/donors" element={
                      userProfile?.role === 'admin' || userProfile?.role === 'hospital' ? (
                        <DonorDirectory />
                      ) : <Navigate to="/" />
                    } />
                    <Route path="/history" element={<div className="p-8 text-center">Donation History</div>} />
                    <Route path="/notifications" element={<div className="p-8 text-center">Notification Center</div>} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Routes>
                </motion.div>
              </AnimatePresence>
            </main>
            <BottomNav role={userProfile?.role || null} />
          </>
        )}
      </div>
    </Router>
  );
}
