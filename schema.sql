-- PostgreSQL Schema for LifeLine Blood App

-- Users table
CREATE TABLE users (
  uid VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL,
  display_name VARCHAR(255),
  photo_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Donors table
CREATE TABLE donors (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(uid),
  blood_type VARCHAR(10) NOT NULL,
  last_donation_date TIMESTAMP,
  is_eligible BOOLEAN DEFAULT TRUE,
  donation_count INTEGER DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location_name VARCHAR(255),
  phone_number VARCHAR(50)
);

-- Hospitals table
CREATE TABLE hospitals (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(uid),
  name VARCHAR(255) NOT NULL,
  license_number VARCHAR(255),
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_approved BOOLEAN DEFAULT FALSE
);

-- Blood Requests table
CREATE TABLE blood_requests (
  id SERIAL PRIMARY KEY,
  hospital_id VARCHAR(255) REFERENCES users(uid),
  blood_type VARCHAR(10) NOT NULL,
  quantity_ml INTEGER NOT NULL,
  urgency VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  patient_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  donor_id VARCHAR(255) REFERENCES users(uid),
  hospital_id VARCHAR(255) REFERENCES users(uid),
  hospital_name VARCHAR(255),
  scheduled_at TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  recipient_id VARCHAR(255) REFERENCES users(uid),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(50) DEFAULT 'medium',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
