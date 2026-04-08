/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  Building2,
  Hospital as HospitalIcon,
  Activity,
  MapPin,
  Menu,
  X,
  ChevronRight,
  ShieldCheck,
  Star,
  MessageSquare,
  RefreshCw,
  Database as DatabaseIcon,
  Send
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
  BloodRequest, 
  Notification as AppNotification,
  UserRole,
  DonationFeedback,
  DonationAppointment,
  Message
} from './types';
import { forecastBloodDemand } from './services/geminiService';
import { broadcastUrgentRequest, calculateDistance } from './services/notificationService';
import { api } from './services/api';

// --- Components ---

const Button = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  disabled = false,
  type = 'button'
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost',
  size?: 'sm' | 'md' | 'lg',
  className?: string,
  disabled?: boolean,
  type?: 'button' | 'submit' | 'reset'
}) => {
  const sizeStyles = {
    sm: "px-4 py-2 text-sm rounded-xl",
    md: "px-6 py-3 rounded-2xl",
    lg: "px-8 py-4 text-lg rounded-[2rem]"
  };
  const baseStyles = `font-display font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 ${sizeStyles[size]}`;
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-200 hover:shadow-brand-300",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200",
    outline: "border-2 border-brand-600 text-brand-600 hover:bg-brand-50",
    danger: "bg-brand-100 text-brand-700 hover:bg-brand-200",
    ghost: "text-slate-600 hover:bg-slate-100"
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
  <div className={`bg-white rounded-[2rem] premium-shadow border border-slate-100 p-6 md:p-8 ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, variant = 'info' }: { children: React.ReactNode, variant?: 'info' | 'success' | 'warning' | 'danger' }) => {
  const variants = {
    info: "bg-blue-50 text-blue-700 border-blue-100",
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    danger: "bg-brand-50 text-brand-700 border-brand-100"
  };
  return (
    <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${variants[variant]}`}>
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
    { label: 'Home', path: '/', icon: LayoutDashboard, roles: ['admin', 'donor'] },
    { label: 'Messages', path: '/messages', icon: MessageSquare, roles: ['admin', 'donor'] },
    { label: 'Schedule', path: '/schedule', icon: Clock, roles: ['donor'] },
    { label: 'Profile', path: '/profile', icon: User, roles: ['donor'] },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => role && item.roles.includes(role)).slice(0, 4);

  if (!role) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50 pb-safe">
      <div className="flex justify-around items-center h-20 px-2">
        {filteredItems.map(item => (
          <Link 
            key={item.path} 
            to={item.path}
            className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-2xl transition-all duration-300 ${
              location.pathname === item.path 
                ? 'text-brand-600 bg-brand-50/50' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <item.icon className={`w-6 h-6 ${location.pathname === item.path ? 'scale-110' : ''} transition-transform`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
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
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'donor'] },
    { label: 'Messages', path: '/messages', icon: MessageSquare, roles: ['admin', 'donor'] },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
    { label: 'Donors', path: '/donors', icon: User, roles: ['admin'] },
    { label: 'Profile', path: '/profile', icon: User, roles: ['donor'] },
    { label: 'Schedule', path: '/schedule', icon: Clock, roles: ['donor'] },
    { label: 'History', path: '/history', icon: History, roles: ['donor'] },
    { label: 'Notifications', path: '/notifications', icon: Bell, roles: ['admin', 'donor'] },
  ];

  const filteredItems = navItems.filter(item => role && item.roles.includes(role));

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-200 group-hover:scale-105 transition-transform">
                <Droplets className="text-white w-7 h-7" />
              </div>
              <span className="text-2xl font-display font-extrabold text-slate-900 tracking-tight">Blood<span className="text-brand-600">Suite</span></span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {filteredItems.map(item => (
              <Link 
                key={item.path} 
                to={item.path}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  location.pathname === item.path 
                    ? 'text-brand-600 bg-brand-50' 
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </div>
              </Link>
            ))}
            {user && (
              <div className="flex items-center gap-4 ml-4 pl-6 border-l border-slate-100">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-bold text-slate-900 leading-none mb-1">{user.displayName}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{role}</p>
                </div>
                <button onClick={onSignOut} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <div className="flex items-center gap-3">
              {user && (
                <button onClick={onSignOut} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all">
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
  const [view, setView] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Registration form state
  const [regData, setRegData] = useState({
    fullName: '',
    phoneNumber: '',
    bloodType: 'O+',
    location: '',
    locationCoords: null as { latitude: number, longitude: number } | null
  });

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setRegData(prev => ({
            ...prev,
            locationCoords: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          }));
        },
        (err) => {
          console.error("Error getting location:", err);
          setError("Could not get your location. Please check browser permissions.");
        }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const handleGoogleLogin = async (isRegistration = false) => {
    if (isRegistration) {
      if (!regData.fullName || !regData.phoneNumber) {
        setError("Please fill in all required fields.");
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
          role: 'donor',
          displayName: isRegistration ? regData.fullName : user.displayName,
          photoURL: user.photoURL,
          createdAt: new Date().toISOString()
        });

        // Create donor profile
        await setDoc(doc(db, 'donors', user.uid), {
          userId: user.uid,
          bloodType: isRegistration ? regData.bloodType : 'O+',
          phoneNumber: isRegistration ? regData.phoneNumber : '',
          locationName: isRegistration ? regData.location : '',
          location: regData.locationCoords,
          isEligible: true,
          donationCount: 0,
          createdAt: new Date().toISOString()
        });
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
    <div className="min-h-screen flex flex-col md:flex-row bg-white overflow-hidden">
      {/* Hero Side */}
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 bg-brand-600 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-20">
          <img 
            src="https://picsum.photos/seed/blood-donation/1920/1080?blur=2" 
            alt="Hero" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="relative z-10 max-w-xl text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center justify-center mb-8 border border-white/20">
              <Droplets className="text-white w-10 h-10" />
            </div>
            <h1 className="text-6xl font-display font-extrabold leading-tight mb-6 tracking-tighter">
              Save a life <br />
              <span className="text-brand-200">with every drop.</span>
            </h1>
            <p className="text-xl text-brand-50/80 mb-12 leading-relaxed font-medium">
              Join the most advanced blood donation network in Lesotho. 
              Real-time tracking, secure messaging, and instant emergency alerts.
            </p>
            
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-3xl font-display font-bold mb-1">5k+</p>
                <p className="text-sm text-brand-100/60 font-bold uppercase tracking-widest">Donors</p>
              </div>
              <div>
                <p className="text-3xl font-display font-bold mb-1">50+</p>
                <p className="text-sm text-brand-100/60 font-bold uppercase tracking-widest">Partners</p>
              </div>
              <div>
                <p className="text-3xl font-display font-bold mb-1">24/7</p>
                <p className="text-sm text-brand-100/60 font-bold uppercase tracking-widest">Support</p>
              </div>
            </div>
          </motion.div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-brand-500 rounded-full blur-3xl opacity-50 animate-pulse-soft" />
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-brand-700 rounded-full blur-3xl opacity-50" />
      </div>

      {/* Form Side */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-20 bg-[#FAFAFA]">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="max-w-md w-full"
        >
          <div className="md:hidden text-center mb-12">
            <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center shadow-xl shadow-brand-200 mx-auto mb-4">
              <Droplets className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">BloodSuite</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-display font-extrabold text-slate-900 mb-3 tracking-tight">
              {view === 'login' ? 'Welcome back' : 'Join the mission'}
            </h2>
            <p className="text-slate-500 font-medium">
              {view === 'login' 
                ? 'Sign in to manage your donations and messages.' 
                : 'Create your account and start saving lives today.'}
            </p>
          </div>

          {error && (
            <div className="bg-brand-50 text-brand-700 p-4 rounded-2xl mb-8 text-sm font-bold flex items-center gap-3 border border-brand-100">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {view === 'login' ? (
            <div className="space-y-6">
              <Button 
                onClick={() => handleGoogleLogin(false)} 
                className="w-full py-4 text-lg" 
                disabled={loading}
              >
                <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                {loading ? 'Authenticating...' : 'Continue with Google'}
              </Button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
                <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-[0.2em]"><span className="bg-[#FAFAFA] px-4 text-slate-400">New to Blood Suite?</span></div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setView('register')} 
                className="w-full py-4"
                disabled={loading}
              >
                Create Account
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleGoogleLogin(true); }}>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">
                    Full Name
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                    placeholder="John Doe"
                    value={regData.fullName}
                    onChange={(e) => setRegData({...regData, fullName: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                    placeholder="+266 5800 0000"
                    value={regData.phoneNumber}
                    onChange={(e) => setRegData({...regData, phoneNumber: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Blood Type</label>
                    <select 
                      className="w-full px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium appearance-none"
                      value={regData.bloodType}
                      onChange={(e) => setRegData({...regData, bloodType: e.target.value})}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Location</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        className="flex-1 px-5 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                        placeholder="Maseru"
                        value={regData.location}
                        onChange={(e) => setRegData({...regData, location: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={requestLocation}
                        className={`w-14 rounded-2xl border transition-all flex items-center justify-center ${regData.locationCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <MapPin className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full py-4 text-lg mt-4" 
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Register as Donor'}
                </Button>
                <button 
                  type="button"
                  onClick={() => setView('login')} 
                  className="w-full py-2 text-sm font-bold text-slate-400 hover:text-brand-600 transition-colors"
                  disabled={loading}
                >
                  Already have an account? Sign In
                </button>
              </form>
            </div>
          )}
          
          <p className="text-[10px] font-bold text-center text-slate-400 uppercase tracking-[0.2em] mt-12">
            Secure • Encrypted • Life-Saving
          </p>
        </motion.div>
      </div>
    </div>
  );
};


const DonorDashboard = ({ user, donorProfile }: { user: FirebaseUser, donorProfile: DonorProfile | null }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string, isVisible: boolean }>({ message: '', isVisible: false });
  const [showMobileInfo, setShowMobileInfo] = useState(false);

  const showToast = (message: string) => {
    setToast({ message, isVisible: true });
  };

  useEffect(() => {
    if (!user) return;
    
    const appointmentsQ = query(
      collection(db, 'appointments'),
      where('donorId', '==', user.uid),
      orderBy('scheduledAt', 'desc')
    );

    const unsubscribeAppointments = onSnapshot(appointmentsQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHistory(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    const notifQ = query(
      collection(db, 'notifications'), 
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribeNotif = onSnapshot(notifQ, (snapshot) => {
      const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      
      setNotifications(prev => {
        // Check for new critical notifications to trigger browser alert
        if (newNotifs.length > 0 && prev.length > 0) {
          const latest = newNotifs[0];
          const oldLatest = prev[0];
          
          if (latest.id !== oldLatest.id && !latest.isRead && (latest.priority === 'critical' || latest.priority === 'high')) {
            if (window.Notification && Notification.permission === "granted") {
              new Notification(latest.title, {
                body: latest.message,
                tag: latest.id
              });
            }
          }
        }
        return newNotifs;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    // Request notification permission
    if (window.Notification && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      unsubscribeNotif();
      unsubscribeAppointments();
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
    <div className="space-y-8 pb-24 md:pb-0">
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

      {/* Mobile Info Modal */}
      <AnimatePresence>
        {showMobileInfo && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileInfo(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] p-8 max-w-lg w-full premium-shadow"
            >
              <button 
                onClick={() => setShowMobileInfo(false)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-brand-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="w-16 h-16 bg-brand-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-brand-200">
                <Droplets className="text-white w-8 h-8" />
              </div>
              
              <h2 className="text-3xl font-display font-extrabold text-slate-900 mb-4 tracking-tight">Run on your phone</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">
                BloodSuite is a Progressive Web App (PWA) designed to work perfectly on mobile devices.
              </p>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600">1</div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Open on mobile</h4>
                    <p className="text-sm text-slate-500">Scan the QR code or open the shared URL in Safari (iOS) or Chrome (Android).</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600">2</div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Add to Home Screen</h4>
                    <p className="text-sm text-slate-500">Tap the "Share" icon (iOS) or "Menu" (Android) and select <strong>"Add to Home Screen"</strong>.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-600">3</div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">Launch App</h4>
                    <p className="text-sm text-slate-500">The app will now appear on your home screen and run in full-screen mode like a native app.</p>
                  </div>
                </div>
              </div>
              
              <Button onClick={() => setShowMobileInfo(false)} className="w-full mt-10 py-4">
                Got it!
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Urgent Notifications Banner */}
      {notifications.filter(n => !n.isRead && (n.priority === 'critical' || n.priority === 'high')).map(n => (
        <motion.div 
          key={n.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className={`p-5 rounded-[2rem] shadow-xl flex items-center justify-between gap-4 ${
            n.priority === 'critical' ? 'bg-brand-600' : 'bg-orange-500'
          } text-white premium-shadow`}
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl animate-pulse">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg">{n.title}</h3>
              <p className="text-sm text-white/80 font-medium">{n.message}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/schedule">
              <Button variant="secondary" className="bg-white text-brand-600 hover:bg-brand-50 text-sm py-2 px-4">
                Help Now
              </Button>
            </Link>
            <button onClick={() => markAsRead(n.id!)} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-xl transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      ))}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-extrabold text-slate-900 tracking-tight">Hello, {user.displayName?.split(' ')[0]}!</h1>
          <p className="text-slate-500 font-medium mt-1">
            Your blood type: <span className="font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg">{donorProfile?.bloodType || 'Not set'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => window.location.reload()} 
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all md:hidden"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          {isEligible ? (
            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 font-bold text-sm">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Eligible to Donate
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl border border-amber-100 font-bold text-sm">
              <Clock className="w-4 h-4" />
              Next: {format(nextEligibleDate, 'MMM dd')}
            </div>
          )}
        </div>
      </header>

      {/* Quick Actions - Bento Style */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/schedule" className="bg-brand-600 p-6 rounded-[2rem] text-white shadow-xl shadow-brand-200 flex flex-col items-start justify-between h-40 hover:scale-[1.02] transition-transform group">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform">
            <Calendar className="w-6 h-6" />
          </div>
          <span className="text-lg font-display font-bold">Schedule <br />Donation</span>
        </Link>
        <Link to="/messages" className="bg-white p-6 rounded-[2rem] text-slate-900 border border-slate-100 premium-shadow flex flex-col items-start justify-between h-40 hover:scale-[1.02] transition-transform group">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:-rotate-12 transition-transform">
            <MessageSquare className="w-6 h-6" />
          </div>
          <span className="text-lg font-display font-bold">Messages <br />System</span>
        </Link>
        <button 
          onClick={() => setShowMobileInfo(true)}
          className="bg-slate-900 p-6 rounded-[2rem] text-white flex flex-col items-start justify-between h-40 hover:scale-[1.02] transition-transform group"
        >
          <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Droplets className="w-6 h-6 text-brand-400" />
          </div>
          <span className="text-lg font-display font-bold text-left">Run on <br />Phone</span>
        </button>
        <Link to="/profile" className="bg-white p-6 rounded-[2rem] text-slate-900 border border-slate-100 premium-shadow flex flex-col items-start justify-between h-40 hover:scale-[1.02] transition-transform group">
          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:scale-110 transition-transform">
            <User className="w-6 h-6" />
          </div>
          <span className="text-lg font-display font-bold">My <br />Profile</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-display font-extrabold flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-brand-600" />
              </div>
              Recent Donations
            </h2>
            <Button variant="ghost" className="text-sm font-bold">View All</Button>
          </div>
          
          {history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-5 rounded-3xl border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100 transition-all group"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Droplets className="w-7 h-7 text-brand-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg leading-tight mb-1">{item.hospitalName}</p>
                      <p className="text-sm text-slate-400 font-medium">{format(new Date(item.scheduledAt), 'MMMM dd, yyyy')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'danger' : 'info'}>
                      {item.status}
                    </Badge>
                    {item.status === 'completed' && (
                      <button 
                        className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                        onClick={() => openFeedback(item)}
                        title="Give Feedback"
                      >
                        <Star className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Droplets className="w-10 h-10 text-slate-200" />
              </div>
              <p className="text-slate-400 font-medium">No donation history yet.</p>
              <Link to="/schedule">
                <Button variant="ghost" className="mt-2 text-brand-600 font-bold">Schedule your first donation</Button>
              </Link>
            </div>
          )}
        </Card>

        <div className="space-y-8">
          <Card className="p-8">
            <h3 className="text-xl font-display font-extrabold flex items-center gap-3 mb-8">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
              </div>
              Achievements
            </h3>
            <div className="space-y-8">
              <div className="flex flex-wrap gap-4">
                {donorProfile?.donationCount && donorProfile.donationCount >= 1 && (
                  <motion.div whileHover={{ scale: 1.1 }} className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 border border-brand-100 shadow-sm" title="First Drop">
                    <Droplets className="w-7 h-7" />
                  </motion.div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 5 && (
                  <motion.div whileHover={{ scale: 1.1 }} className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm" title="Life Saver">
                    <ShieldCheck className="w-7 h-7" />
                  </motion.div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 10 && (
                  <motion.div whileHover={{ scale: 1.1 }} className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100 shadow-sm" title="Hero">
                    <Star className="w-7 h-7" />
                  </motion.div>
                )}
                {donorProfile?.donationCount && donorProfile.donationCount >= 25 && (
                  <motion.div whileHover={{ scale: 1.1 }} className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 border border-purple-100 shadow-sm" title="Legend">
                    <Activity className="w-7 h-7" />
                  </motion.div>
                )}
                {(!donorProfile?.donationCount || donorProfile.donationCount === 0) && (
                  <p className="text-sm text-slate-400 italic leading-relaxed">Complete your first donation to earn exclusive badges!</p>
                )}
              </div>

              {donorProfile?.donationCount !== undefined && (
                <div className="space-y-3">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                    <span>Next Milestone</span>
                    <span>{donorProfile.donationCount} / {donorProfile.donationCount < 1 ? 1 : donorProfile.donationCount < 5 ? 5 : donorProfile.donationCount < 10 ? 10 : 25}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(donorProfile.donationCount / (donorProfile.donationCount < 1 ? 1 : donorProfile.donationCount < 5 ? 5 : donorProfile.donationCount < 10 ? 10 : 25)) * 100}%` }}
                      className="h-full bg-brand-600 rounded-full shadow-lg shadow-brand-200"
                    />
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-8 bg-slate-900 text-white border-none">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-display font-extrabold flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                  <Bell className="w-5 h-5 text-brand-400" />
                </div>
                Alerts
              </h3>
              <Link to="/notifications" className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors uppercase tracking-widest">View All</Link>
            </div>
            <div className="space-y-4">
              {notifications.length > 0 ? notifications.map((n, i) => (
                <div key={n.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                  <p className="text-sm font-bold mb-1 line-clamp-1">{n.title}</p>
                  <p className="text-xs text-white/60 line-clamp-2 leading-relaxed">{n.message}</p>
                </div>
              )) : (
                <p className="text-sm text-white/40 italic">No new notifications.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-brand-600 to-brand-700 text-white border-none p-8 mt-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-extrabold">Ready to save a life?</h2>
            {isEligible ? (
              <p className="text-brand-100 font-medium">There is currently a high demand for {donorProfile?.bloodType} blood in Maseru.</p>
            ) : (
              <p className="text-brand-100 font-medium">You will be eligible to donate again on {format(nextEligibleDate, 'MMMM dd, yyyy')}.</p>
            )}
          </div>
          <Link to={isEligible ? "/schedule" : "#"}>
            <Button 
              variant="secondary" 
              className={`bg-white text-brand-600 hover:bg-brand-50 px-8 py-4 text-lg font-bold ${!isEligible ? 'opacity-50 cursor-not-allowed' : ''}`}
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
  const [hospitals, setHospitals] = useState<{ userId: string, name: string, address: string }[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [date, setDate] = useState<string>(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [time, setTime] = useState<string>('09:00');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [appointmentDetails, setAppointmentDetails] = useState<{ hospitalName: string, date: string, time: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const q = query(collection(db, 'hospitals'), where('isApproved', '==', true));
        const snapshot = await getDocs(q);
        setHospitals(snapshot.docs.map(doc => doc.data() as { userId: string, name: string, address: string }));
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
      
      setAppointmentDetails({
        hospitalName: hospital?.name || 'Unknown Hospital',
        date,
        time
      });
      setShowSuccessModal(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
      <AppointmentConfirmationModal 
        isOpen={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)} 
        details={appointmentDetails} 
      />
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

// --- Feedback Components ---

const AppointmentConfirmationModal = ({ 
  isOpen, 
  onClose, 
  details 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  details: { hospitalName: string, date: string, time: string } | null 
}) => {
  if (!details) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Donation Scheduled!</h2>
              <p className="text-gray-600 mb-8">
                Thank you for your commitment. Your appointment has been successfully booked.
              </p>
              
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 mb-8 text-left">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Date</span>
                    <span className="font-medium">{format(new Date(details.date), 'MMMM dd, yyyy')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Time</span>
                    <span className="font-medium">{details.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Location</span>
                    <span className="font-medium">{details.hospitalName}</span>
                  </div>
                </div>
              </div>

              <Link to="/" onClick={onClose}>
                <Button variant="primary" className="w-full py-3 text-lg">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

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
  const [donors, setDonors] = useState<(DonorProfile & { displayName: string, email: string, distance?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('All');
  const [sortByProximity, setSortByProximity] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number, longitude: number } | null>(null);

  useEffect(() => {
    if (sortByProximity && !currentLocation) {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setCurrentLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
          },
          (err) => {
            console.error("Error getting location:", err);
            setSortByProximity(false);
          }
        );
      } else {
        setSortByProximity(false);
      }
    }
  }, [sortByProximity]);

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        const donorsSnap = await getDocs(collection(db, 'donors'));
        const donorsData = donorsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        
        // Fetch user profiles for display names
        const userPromises = donorsData.map(d => getDoc(doc(db, 'users', d.userId)));
        const userSnaps = await Promise.all(userPromises);
        const userMap = userSnaps.reduce((acc, snap) => {
          if (snap.exists()) {
            acc[snap.id] = snap.data();
          }
          return acc;
        }, {} as any);

        const merged = donorsData.map(d => ({
          ...d,
          displayName: userMap[d.userId]?.displayName || 'Unknown Donor',
          email: userMap[d.userId]?.email || '',
          distance: currentLocation && d.location ? calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            d.location.latitude,
            d.location.longitude
          ) : undefined
        }));

        setDonors(merged);
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'donors');
      } finally {
        setLoading(false);
      }
    };

    fetchDonors();
  }, [currentLocation]);

  const filteredDonors = donors.filter(donor => {
    const matchesSearch = 
      donor.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donor.locationName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      donor.bloodType.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesBloodType = bloodTypeFilter === 'All' || donor.bloodType === bloodTypeFilter;
    
    return matchesSearch && matchesBloodType;
  });

  const sortedDonors = [...filteredDonors].sort((a, b) => {
    if (sortByProximity) {
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
    }
    return 0; // Keep original order if not sorting by proximity or distances missing
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
          <div className="flex gap-4">
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
            <button
              onClick={() => setSortByProximity(!sortByProximity)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                sortByProximity 
                  ? 'bg-red-50 border-red-200 text-red-600' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Nearby</span>
            </button>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw className="w-8 h-8 text-red-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDonors.map(donor => (
            <div key={donor.userId}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-600 font-bold text-lg shrink-0">
                    {donor.bloodType}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 truncate">{donor.displayName}</h3>
                      {donor.distance !== undefined && (
                        <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                          {donor.distance.toFixed(1)} km
                        </span>
                      )}
                    </div>
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
          {sortedDonors.length === 0 && (
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
  const [stats, setStats] = useState({
    totalDonors: 0,
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

    // Fetch other stats
    const fetchStats = async () => {
      const donors = await getDocs(collection(db, 'donors'));
      const appointments = await getDocs(query(collection(db, 'appointments'), where('status', '==', 'completed')));
      
      setStats(prev => ({
        ...prev,
        totalDonors: donors.size,
        totalDonations: appointments.size
      }));
    };
    fetchStats();

    return () => { unsubFeedbacks(); };
  }, []);

  return (
    <div className="space-y-10 pb-24 md:pb-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-display font-extrabold text-slate-900 tracking-tight">System Administration</h1>
          <p className="text-slate-500 font-medium mt-1">Overview of Blood Suite operations and donor feedback</p>
        </div>
        <div className="flex gap-4">
          <Link to="/donors">
            <Button variant="outline">Manage Donors</Button>
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 hover:scale-[1.02] transition-transform group">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:rotate-12 transition-transform">
              <User className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Total Donors</p>
              <p className="text-4xl font-display font-extrabold text-slate-900">{stats.totalDonors}</p>
            </div>
          </div>
        </Card>
        <Card className="p-8 hover:scale-[1.02] transition-transform group">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:-rotate-12 transition-transform">
              <Droplets className="w-8 h-8" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Donations</p>
              <p className="text-4xl font-display font-extrabold text-slate-900">{stats.totalDonations}</p>
            </div>
          </div>
        </Card>
        <Card className="p-8 hover:scale-[1.02] transition-transform group">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Star className="w-8 h-8 fill-amber-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Avg Rating</p>
              <p className="text-4xl font-display font-extrabold text-slate-900">{stats.avgRating.toFixed(1)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Donor Feedback */}
        <Card className="p-0 overflow-hidden border-none premium-shadow lg:col-span-2">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-2xl font-display font-extrabold text-slate-900">Recent Donor Feedback</h2>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
              <MessageSquare className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-bold text-slate-600">{feedbacks.length} Responses</span>
            </div>
          </div>
          <div className="p-8 space-y-6 max-h-[600px] overflow-y-auto custom-scrollbar">
            {feedbacks.length > 0 ? feedbacks.map((f, i) => (
              <motion.div 
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-[2rem] border border-slate-50 hover:bg-slate-50/50 hover:border-slate-100 transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center font-display font-bold text-slate-500 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                      {f.donorName[0]}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-lg leading-tight">{f.donorName}</p>
                      <p className="text-sm text-slate-400 font-medium">at {f.hospitalName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-3.5 h-3.5 ${f.rating >= s ? 'text-amber-500 fill-current' : 'text-amber-200'}`} />
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <span className="absolute -left-2 -top-2 text-4xl text-slate-100 font-serif">"</span>
                  <p className="text-slate-600 text-lg italic leading-relaxed pl-4 relative z-10">{f.comment}</p>
                </div>
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-50">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(new Date(f.createdAt), 'MMM dd, yyyy • HH:mm')}</p>
                  <button className="text-xs font-bold text-brand-600 hover:underline">Reply</button>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-10 h-10 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium">No feedback received yet.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="md:hidden pt-8">
        <Button 
          variant="outline" 
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 border-slate-200 text-slate-600"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

const MessagesPage = ({ user }: { user: FirebaseUser }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('senderId', 'in', [user.uid, 'system']),
      where('recipientId', 'in', [user.uid, 'system']),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((msg: any) => 
          (msg.senderId === user.uid && msg.recipientId === 'system') ||
          (msg.senderId === 'system' && msg.recipientId === user.uid)
        );
      setMessages(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
      setLoading(false);
    });

    return unsubscribe;
  }, [user.uid]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        senderId: user.uid,
        recipientId: 'system',
        content: newMessage,
        isRead: false,
        createdAt: Timestamp.now()
      });
      setNewMessage('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setSending(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 space-y-4">
      <div className="w-12 h-12 border-4 border-brand-100 border-t-brand-600 rounded-full animate-spin" />
      <p className="text-slate-400 font-medium">Loading conversation...</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col pb-24 md:pb-0">
      <header className="mb-8 shrink-0">
        <h1 className="text-4xl font-display font-extrabold text-slate-900 tracking-tight">Messages</h1>
        <div className="flex items-center gap-2 mt-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Secure connection active</p>
        </div>
      </header>

      <Card className="flex-1 flex flex-col overflow-hidden p-0 border-none premium-shadow">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900">Support & Coordination</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Official Channel</p>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar bg-slate-50/30 flex flex-col-reverse"
        >
          {messages.length > 0 ? (
            messages.map((msg, i) => {
              const isMe = msg.senderId === user.uid;
              return (
                <motion.div 
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] md:max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1.5`}>
                    <div className={`px-6 py-4 rounded-[2rem] text-sm font-medium leading-relaxed shadow-sm ${
                      isMe 
                        ? 'bg-brand-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">
                      {isMe ? 'You' : 'System'} • {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), 'HH:mm') : 'Just now'}
                    </span>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-12 py-20">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-8">
                <MessageSquare className="w-12 h-12 text-slate-300" />
              </div>
              <h4 className="text-2xl font-display font-bold text-slate-900 mb-3">No messages yet</h4>
              <p className="text-slate-400 leading-relaxed font-medium">
                Start a conversation with our coordination team. We're here to help with your donation journey.
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-white border-t border-slate-100 shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-4">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
              disabled={sending}
            />
            <Button 
              type="submit" 
              className="px-8"
              disabled={sending || !newMessage.trim()}
            >
              {sending ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
};

const HospitalDashboard = () => null;

const HospitalProfilePage = () => null;

const HospitalDirectory = () => null;

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [donorProfile, setDonorProfile] = useState<DonorProfile | null>(null);
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
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        }
      } else {
        setUserProfile(null);
        setDonorProfile(null);
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
                      ) : userProfile?.role === 'admin' ? (
                        <AdminDashboard />
                      ) : (
                        <div className="text-center py-20">
                          <Droplets className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                    <Route path="/donors" element={
                      userProfile?.role === 'admin' ? (
                        <DonorDirectory />
                      ) : <Navigate to="/" />
                    } />
                    <Route path="/messages" element={<MessagesPage user={user} />} />
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
