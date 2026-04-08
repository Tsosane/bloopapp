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
  Send,
  Heart,
  Zap,
  Quote
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
    { label: 'Schedule', path: '/schedule', icon: Calendar, roles: ['donor'] },
    { label: 'Profile', path: '/profile', icon: User, roles: ['donor'] },
    { label: 'Admin', path: '/admin', icon: ShieldCheck, roles: ['admin'] },
  ];

  const filteredItems = navItems.filter(item => role && item.roles.includes(role)).slice(0, 4);

  if (!role) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-slate-100 z-50 pb-safe">
      <div className="flex justify-around items-center h-20 px-4">
        {filteredItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 transition-all duration-500 ${
                isActive ? 'text-brand-600' : 'text-slate-400'
              }`}
            >
              {isActive && (
                <motion.div 
                  layoutId="bottomNavTab"
                  className="absolute inset-0 bg-brand-50 rounded-2xl -z-10"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} transition-transform duration-500`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
            </Link>
          );
        })}
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
    <nav className="bg-white/80 backdrop-blur-xl border-b border-slate-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-4 group">
              <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center shadow-lg shadow-brand-500/20 group-hover:rotate-12 transition-transform">
                <Droplets className="text-white w-7 h-7" />
              </div>
              <span className="text-2xl font-display font-black text-slate-900 tracking-tighter">LifeLine</span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            {filteredItems.map(item => {
              const isActive = location.pathname === item.path;
              return (
                <Link 
                  key={item.path} 
                  to={item.path}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                    isActive 
                      ? 'text-brand-600 bg-brand-50' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </div>
                </Link>
              );
            })}
            {user && (
              <div className="flex items-center gap-4 ml-4 pl-6 border-l border-slate-100">
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-black text-slate-900 leading-none mb-1">{user.displayName}</p>
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
            <div className="w-20 h-20 bg-brand-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-500/30 mx-auto mb-6">
              <Droplets className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-display font-black text-slate-900 tracking-tighter">LifeLine</h1>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">Mission Control</p>
          </div>

          <div className="mb-12">
            <h2 className="text-5xl font-display font-black text-slate-900 mb-4 tracking-tighter leading-none">
              {view === 'login' ? 'Welcome back.' : 'Join the mission.'}
            </h2>
            <p className="text-slate-500 font-medium text-lg">
              {view === 'login' 
                ? 'Sign in to manage your donations and track your impact.' 
                : 'Create your identity and start saving lives in Lesotho.'}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-brand-50 text-brand-700 p-5 rounded-3xl mb-10 text-sm font-bold flex items-center gap-4 border border-brand-100"
            >
              <AlertTriangle className="w-6 h-6 shrink-0" />
              {error}
            </motion.div>
          )}

          {view === 'login' ? (
            <div className="space-y-8">
              <Button 
                onClick={() => handleGoogleLogin(false)} 
                className="w-full py-5 text-lg rounded-2xl shadow-xl shadow-brand-500/10" 
                disabled={loading}
              >
                <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center mr-2">
                  <User className="w-5 h-5" />
                </div>
                {loading ? 'Connecting...' : 'Continue with Google'}
              </Button>
              
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
                <div className="relative flex justify-center text-[10px] font-black uppercase tracking-[0.3em]"><span className="bg-[#FAFAFA] px-6 text-slate-400">New to LifeLine?</span></div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setView('register')} 
                className="w-full py-5 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50"
                disabled={loading}
              >
                Create Donor Account
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleGoogleLogin(true); }}>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    Full Legal Name
                  </label>
                  <input 
                    type="text" 
                    required
                    className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900"
                    placeholder="John Doe"
                    value={regData.fullName}
                    onChange={(e) => setRegData({...regData, fullName: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                  <input 
                    type="tel" 
                    required
                    className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900"
                    placeholder="+266 5800 0000"
                    value={regData.phoneNumber}
                    onChange={(e) => setRegData({...regData, phoneNumber: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Blood Type</label>
                    <select 
                      className="w-full px-6 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900 appearance-none"
                      value={regData.bloodType}
                      onChange={(e) => setRegData({...regData, bloodType: e.target.value})}
                    >
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        className="flex-1 px-6 py-4 rounded-2xl bg-white border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900"
                        placeholder="Maseru"
                        value={regData.location}
                        onChange={(e) => setRegData({...regData, location: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={requestLocation}
                        className={`w-14 rounded-2xl border transition-all flex items-center justify-center ${regData.locationCoords ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}
                      >
                        <MapPin className="w-6 h-6" />
                      </button>
                    </div>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full py-5 text-lg mt-6 rounded-2xl shadow-xl shadow-brand-500/20" 
                  disabled={loading}
                >
                  {loading ? 'Creating Identity...' : 'Register as Donor'}
                </Button>
                <button 
                  type="button"
                  onClick={() => setView('login')} 
                  className="w-full py-4 text-sm font-black text-slate-400 hover:text-brand-600 transition-colors uppercase tracking-widest"
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
    <div className="space-y-10 pb-12">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-[3rem] bg-slate-900 text-white p-10 md:p-16">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand-600/20 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-400 text-xs font-bold uppercase tracking-widest">
              <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
              Active Donor Status
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight">
              Hello, <span className="text-brand-500">{user.displayName?.split(' ')[0]}</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-xl leading-relaxed">
              Your commitment saves lives. You've helped <span className="text-white font-bold">{(donorProfile?.donationCount || 0) * 3} people</span> through your donations.
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 md:w-32 md:h-32 bg-brand-600 rounded-[2.5rem] flex flex-col items-center justify-center shadow-2xl shadow-brand-500/20 rotate-3">
              <Droplets className="w-8 h-8 md:w-10 md:h-10 text-white mb-1" />
              <span className="text-2xl md:text-3xl font-display font-black">{donorProfile?.bloodType || '--'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 border-none premium-shadow bg-white group hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
              <Activity className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Donations</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-5xl font-display font-black text-slate-900">{donorProfile?.donationCount || 0}</h4>
            <p className="text-slate-400 font-medium">Total successful drops</p>
          </div>
        </Card>

        <Card className={`p-8 border-none premium-shadow transition-all group ${isEligible ? 'bg-emerald-500 text-white' : 'bg-white'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${isEligible ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
              {isEligible ? <CheckCircle2 className="w-7 h-7" /> : <Clock className="w-7 h-7" />}
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-widest ${isEligible ? 'text-white/60' : 'text-slate-400'}`}>Status</span>
          </div>
          <div className="space-y-1">
            <h4 className={`text-4xl font-display font-black ${isEligible ? 'text-white' : 'text-slate-900'}`}>
              {isEligible ? 'Eligible Now' : `${56 - daysSinceLastDonation} Days Left`}
            </h4>
            <p className={isEligible ? 'text-white/80' : 'text-slate-400'}>
              {isEligible ? 'You can donate today' : `Next drop: ${format(nextEligibleDate, 'MMM dd')}`}
            </p>
          </div>
        </Card>

        <Card className="p-8 border-none premium-shadow bg-white group hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
              <Star className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rank</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-4xl font-display font-black text-slate-900">
              {donorProfile?.donationCount && donorProfile.donationCount >= 25 ? 'Legend' : 
               donorProfile?.donationCount && donorProfile.donationCount >= 10 ? 'Hero' :
               donorProfile?.donationCount && donorProfile.donationCount >= 5 ? 'Life Saver' : 'New Donor'}
            </h4>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 rounded-full" 
                  style={{ width: `${((donorProfile?.donationCount || 0) % 5 / 5) * 100}%` }} 
                />
              </div>
              <span className="text-[10px] font-bold text-slate-400">LVL {Math.floor((donorProfile?.donationCount || 0) / 5) + 1}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left Column: History */}
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                <History className="w-6 h-6" />
              </div>
              Recent Activity
            </h2>
            <Button variant="ghost" className="text-brand-600 font-bold">View History</Button>
          </div>

          <div className="space-y-4">
            {history.length > 0 ? history.map((item, i) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group relative bg-white p-6 rounded-[2rem] border border-slate-100 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all"
              >
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-brand-50 transition-colors">
                      <Droplets className="w-8 h-8 text-slate-300 group-hover:text-brand-600 transition-colors" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-slate-900 mb-1">{item.hospitalName}</h4>
                      <div className="flex items-center gap-3 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium">{format(new Date(item.scheduledAt), 'MMMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={item.status === 'completed' ? 'success' : item.status === 'cancelled' ? 'danger' : 'info'}>
                      {item.status}
                    </Badge>
                    {item.status === 'completed' && (
                      <button 
                        onClick={() => openFeedback(item)}
                        className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all"
                      >
                        <Star className="w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )) : (
              <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Droplets className="w-12 h-12 text-slate-200" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">No donations yet</h3>
                <p className="text-slate-400 max-w-xs mx-auto mb-8">Your first donation will appear here once you've completed it.</p>
                <Link to="/schedule">
                  <Button className="px-8">Schedule Now</Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-10">
          {/* Quick Actions */}
          <div className="space-y-6">
            <h3 className="text-xl font-display font-extrabold text-slate-900 tracking-tight uppercase tracking-widest text-[10px] text-slate-400">Quick Actions</h3>
            <div className="grid grid-cols-1 gap-4">
              <Link to="/schedule" className={`group p-6 rounded-[2rem] flex items-center gap-5 transition-all ${isEligible ? 'bg-brand-600 text-white shadow-xl shadow-brand-500/20' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isEligible ? 'bg-white/20' : 'bg-slate-200'}`}>
                  <Plus className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-lg">Schedule Drop</h4>
                  <p className={`text-sm ${isEligible ? 'text-white/70' : 'text-slate-400'}`}>Book your next appointment</p>
                </div>
              </Link>
              
              <Link to="/messages" className="group p-6 rounded-[2rem] bg-white border border-slate-100 hover:border-brand-200 hover:shadow-xl transition-all flex items-center gap-5">
                <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                  <MessageSquare className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-slate-900">Messages</h4>
                  <p className="text-sm text-slate-400">Chat with coordinators</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Achievements */}
          <Card className="p-8 border-none premium-shadow bg-white">
            <h3 className="text-xl font-display font-extrabold text-slate-900 mb-8 flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                <Star className="w-5 h-5 fill-amber-500" />
              </div>
              Badges
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Droplets, title: 'First Drop', count: 1, color: 'brand' },
                { icon: ShieldCheck, title: 'Life Saver', count: 5, color: 'blue' },
                { icon: Star, title: 'Hero', count: 10, color: 'amber' },
                { icon: Activity, title: 'Legend', count: 25, color: 'purple' },
                { icon: Heart, title: 'Angel', count: 50, color: 'pink' },
                { icon: Zap, title: 'Flash', count: 100, color: 'yellow' }
              ].map((badge, i) => {
                const isEarned = (donorProfile?.donationCount || 0) >= badge.count;
                return (
                  <motion.div 
                    key={i}
                    whileHover={isEarned ? { scale: 1.1, rotate: 5 } : {}}
                    className={`aspect-square rounded-2xl flex items-center justify-center transition-all ${
                      isEarned 
                        ? `bg-${badge.color}-50 text-${badge.color}-600 border border-${badge.color}-100 shadow-sm` 
                        : 'bg-slate-50 text-slate-200 border border-slate-100 opacity-50 grayscale'
                    }`}
                    title={badge.title}
                  >
                    <badge.icon className="w-8 h-8" />
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card className="p-8 border-none bg-slate-900 text-white">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-display font-extrabold flex items-center gap-3">
                <Bell className="w-5 h-5 text-brand-400" />
                Alerts
              </h3>
              <Link to="/notifications" className="text-[10px] font-bold text-brand-400 uppercase tracking-widest">View All</Link>
            </div>
            <div className="space-y-4">
              {notifications.length > 0 ? notifications.map(n => (
                <div key={n.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold group-hover:text-brand-400 transition-colors">{n.title}</p>
                    {n.priority === 'critical' && <div className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />}
                  </div>
                  <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">{n.message}</p>
                </div>
              )) : (
                <div className="text-center py-8">
                  <p className="text-sm text-white/30 italic">No new alerts</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.isVisible && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 bg-slate-900 text-white rounded-full shadow-2xl flex items-center gap-4"
          >
            <CheckCircle2 className="w-5 h-5 text-brand-500" />
            <span className="font-bold text-sm tracking-wide">{toast.message}</span>
            <button onClick={() => setToast({ ...toast, isVisible: false })} className="ml-4 text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="text-center p-12 premium-shadow border-none">
          <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <Clock className="w-12 h-12 text-amber-600" />
          </div>
          <h2 className="text-3xl font-display font-black text-slate-900 mb-4 tracking-tighter">Not Eligible Yet</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium">
            To ensure your safety and the quality of the blood supply, you must wait at least 56 days between donations. 
            You will be eligible to save lives again on:
            <br />
            <span className="text-2xl font-black text-brand-600 mt-4 block"> {format(nextEligibleDate, 'MMMM dd, yyyy')}</span>
          </p>
          <Link to="/">
            <Button variant="outline" className="w-full py-4 rounded-2xl font-bold">Return to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-32 md:pb-8">
      <AppointmentConfirmationModal 
        isOpen={showSuccessModal} 
        onClose={() => setShowSuccessModal(false)} 
        details={appointmentDetails} 
      />
      <header>
        <h1 className="text-4xl font-display font-black text-slate-900 tracking-tighter">Schedule</h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Book your next life-saving appointment</p>
      </header>

      <Card className="premium-shadow border-none p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-brand-50 text-brand-700 rounded-2xl text-sm font-bold flex items-center gap-3 border border-brand-100"
            >
              <AlertTriangle className="w-5 h-5" />
              {error}
            </motion.div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <HospitalIcon className="w-4 h-4 text-brand-600" />
                Select Donation Center
              </label>
              <select 
                required
                className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900 appearance-none"
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
              >
                <option value="">Choose a location...</option>
                {hospitals.length > 0 ? hospitals.map(hospital => (
                  <option key={hospital.userId} value={hospital.userId}>
                    {hospital.name} — {hospital.address}
                  </option>
                )) : (
                  <option disabled>No approved centers found</option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-brand-600" />
                  Preferred Date
                </label>
                <input 
                  type="date" 
                  required
                  min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-600" />
                  Preferred Time
                </label>
                <select 
                  required
                  className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-bold text-slate-900 appearance-none"
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

          <div className="p-6 bg-slate-900 rounded-3xl flex gap-4">
            <AlertTriangle className="w-6 h-6 text-brand-400 shrink-0" />
            <div className="text-sm text-slate-300 leading-relaxed">
              <p className="font-black text-white uppercase tracking-widest text-[10px] mb-2">Pre-Donation Checklist</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1">
                <li className="flex items-center gap-2">• Eat a healthy meal</li>
                <li className="flex items-center gap-2">• Drink plenty of water</li>
                <li className="flex items-center gap-2">• Bring valid ID</li>
                <li className="flex items-center gap-2">• Get enough sleep</li>
              </ul>
            </div>
          </div>

          <Button type="submit" className="w-full py-5 rounded-2xl text-lg font-black shadow-xl shadow-brand-500/20" disabled={loading}>
            {loading ? 'Processing...' : 'Schedule Appointment'}
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
    <div className="max-w-2xl mx-auto space-y-8 pb-32 md:pb-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-black text-slate-900 tracking-tighter">Profile</h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Manage your identity</p>
        </div>
        <Button 
          variant={isEditing ? 'ghost' : 'outline'} 
          onClick={() => setIsEditing(!isEditing)}
          className="rounded-xl font-bold"
        >
          {isEditing ? 'Cancel' : 'Edit Profile'}
        </Button>
      </header>

      <Card className="overflow-hidden p-0 border-none premium-shadow">
        <div className="bg-brand-600 h-32 relative">
          <div className="absolute -bottom-12 left-8">
            <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center border-4 border-white overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-12 h-12 text-slate-200" />
              )}
            </div>
          </div>
          <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Verified Donor</span>
          </div>
        </div>

        <div className="p-8 pt-16 space-y-8">
          <div>
            <h2 className="text-2xl font-display font-black text-slate-900">{user.displayName}</h2>
            <p className="text-slate-400 font-medium">{user.email}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Blood Type</p>
              <p className="text-4xl font-display font-black text-brand-600">{donorProfile?.bloodType}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between">
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Status</p>
              <div className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-center ${
                isEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {isEligible ? 'Eligible' : 'Ineligible'}
              </div>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6 pt-8 border-t border-slate-100">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Phone Number</label>
                  <input 
                    type="tel" 
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                    placeholder="+266 ..."
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Location</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                    value={formData.locationName}
                    onChange={(e) => setFormData({...formData, locationName: e.target.value})}
                    placeholder="Maseru, Lesotho"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full py-4 rounded-2xl shadow-lg shadow-brand-500/20" disabled={loading}>
                {loading ? 'Saving Changes...' : 'Update Profile'}
              </Button>
            </form>
          ) : (
            <div className="space-y-6 pt-8 border-t border-slate-100">
              <div className="flex items-center gap-4 text-slate-600 font-medium">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <MapPin className="w-5 h-5" />
                </div>
                <span>{donorProfile?.locationName || 'No location set'}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-600 font-medium">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <Activity className="w-5 h-5" />
                </div>
                <span>{donorProfile?.phoneNumber || 'No phone number set'}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-600 font-medium">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                  <History className="w-5 h-5" />
                </div>
                <span>{donorProfile?.donationCount || 0} Successful Donations</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card className="premium-shadow border-none">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-display font-black text-slate-900">Donation Eligibility</h3>
        </div>
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Last Donation</span>
            <span className="font-black text-slate-900">{donorProfile?.lastDonationDate ? format(new Date(donorProfile.lastDonationDate), 'MMM dd, yyyy') : 'Never'}</span>
          </div>
          <div className="flex items-center justify-between p-4 bg-brand-50/50 rounded-2xl border border-brand-100">
            <span className="text-brand-600 font-bold uppercase tracking-widest text-[10px]">Next Eligible Date</span>
            <span className="font-black text-brand-600">
              {donorProfile?.lastDonationDate 
                ? format(addDays(new Date(donorProfile.lastDonationDate), 56), 'MMM dd, yyyy')
                : 'Available Now'}
            </span>
          </div>
          <div className="p-6 bg-slate-900 rounded-3xl flex gap-4">
            <AlertTriangle className="w-6 h-6 text-brand-400 shrink-0" />
            <p className="text-sm text-slate-300 leading-relaxed">
              To maintain your health and ensure high-quality blood supply, a minimum interval of <span className="text-white font-bold">56 days</span> is required between whole blood donations.
            </p>
          </div>
        </div>
      </Card>

      <div className="md:hidden pt-4">
        <Button 
          variant="ghost" 
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 text-slate-400 font-bold"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Sign Out of Session
        </Button>
      </div>
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
    <div className="space-y-10 pb-12">
      <header className="relative overflow-hidden rounded-[3rem] bg-slate-900 text-white p-10 md:p-16">
        <div className="absolute top-0 right-0 w-1/3 h-full bg-brand-600/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-brand-400 text-xs font-bold uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4" />
              System Administrator
            </div>
            <h1 className="text-5xl md:text-6xl font-display font-extrabold tracking-tight">
              Mission <span className="text-brand-500">Control</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl leading-relaxed">
              Real-time overview of the LifeLine network, donor engagement, and service quality metrics.
            </p>
          </div>
          
          <div className="flex gap-4">
            <Link to="/donors">
              <Button className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 rounded-[2rem] font-bold text-lg shadow-2xl">
                Manage Donors
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-8 border-none premium-shadow bg-white group hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
              <User className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Network</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-5xl font-display font-black text-slate-900">{stats.totalDonors}</h4>
            <p className="text-slate-400 font-medium">Registered Donors</p>
          </div>
        </Card>

        <Card className="p-8 border-none premium-shadow bg-white group hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
              <Droplets className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Impact</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-5xl font-display font-black text-slate-900">{stats.totalDonations}</h4>
            <p className="text-slate-400 font-medium">Successful Drops</p>
          </div>
        </Card>

        <Card className="p-8 border-none premium-shadow bg-white group hover:bg-slate-50 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
              <Star className="w-7 h-7 fill-amber-500" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Quality</span>
          </div>
          <div className="space-y-1">
            <h4 className="text-5xl font-display font-black text-slate-900">{stats.avgRating.toFixed(1)}</h4>
            <p className="text-slate-400 font-medium">Average Donor Rating</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <Card className="p-0 overflow-hidden border-none premium-shadow bg-white">
          <div className="p-10 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
            <div className="space-y-1">
              <h2 className="text-3xl font-display font-extrabold text-slate-900 tracking-tight">Donor Feedback</h2>
              <p className="text-slate-400 font-medium">Latest reviews from the community</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
              <MessageSquare className="w-5 h-5 text-brand-600" />
              <span className="text-lg font-black text-slate-900">{feedbacks.length}</span>
            </div>
          </div>
          
          <div className="p-10 space-y-8 max-h-[800px] overflow-y-auto custom-scrollbar">
            {feedbacks.length > 0 ? feedbacks.map((f, i) => (
              <motion.div 
                key={f.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="group relative p-8 rounded-[2.5rem] border border-slate-50 hover:bg-slate-50/50 hover:border-brand-200 hover:shadow-xl hover:shadow-brand-500/5 transition-all"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center font-display font-black text-2xl text-slate-400 group-hover:bg-brand-600 group-hover:text-white transition-all rotate-3 group-hover:rotate-0">
                      {f.donorName[0]}
                    </div>
                    <div>
                      <h4 className="text-2xl font-bold text-slate-900 tracking-tight">{f.donorName}</h4>
                      <p className="text-slate-400 font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {f.hospitalName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-5 h-5 ${f.rating >= s ? 'text-amber-500 fill-current' : 'text-amber-200'}`} />
                    ))}
                  </div>
                </div>
                
                <div className="relative bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                  <Quote className="absolute -left-3 -top-3 w-8 h-8 text-brand-200 rotate-180" />
                  <p className="text-slate-600 text-xl italic leading-relaxed relative z-10">{f.comment}</p>
                </div>
                
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-3 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{format(new Date(f.createdAt), 'MMM dd, yyyy • HH:mm')}</span>
                  </div>
                  <Button variant="ghost" className="text-brand-600 font-bold hover:bg-brand-50 rounded-xl">
                    Acknowledge
                  </Button>
                </div>
              </motion.div>
            )) : (
              <div className="text-center py-32">
                <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
                  <MessageSquare className="w-16 h-16 text-slate-200" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">No feedback yet</h3>
                <p className="text-slate-400 max-w-xs mx-auto">Donor reviews will appear here as they come in.</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="flex justify-center pt-10">
        <Button 
          variant="ghost" 
          className="text-slate-400 hover:text-brand-600 font-bold flex items-center gap-3"
          onClick={() => auth.signOut()}
        >
          <LogOut className="w-5 h-5" />
          Terminate Session
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
