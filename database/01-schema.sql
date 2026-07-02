-- ==========================================
-- E-COMMERCE MARKETPLACE SUPABASE SCHEMA
-- ==========================================
-- Run this script in your Supabase SQL Editor
-- to set up the complete database architecture.

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLES CREATION
-- ==========================================

-- Users Table (Extended profiles for Auth Users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  department TEXT,
  role TEXT DEFAULT 'user'::text,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products Table
CREATE TABLE public.products (
  product_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  seller_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category TEXT,
  stock INTEGER DEFAULT 1,
  status TEXT DEFAULT 'available'::text,
  images JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders Table
CREATE TABLE public.orders (
  order_id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  buyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(product_id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending'::text,
  delivery_address TEXT,
  slip_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Riders Table (Delivery Personnel)
CREATE TABLE public.riders (
  rider_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  status TEXT DEFAULT 'available'::text,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Messages Table (Chat System)
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Refund Requests Table
CREATE TABLE public.refund_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(order_id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  evidence_image TEXT,
  status TEXT DEFAULT 'pending'::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Product Reports Table
CREATE TABLE public.product_reports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(product_id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS for all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reports ENABLE ROW LEVEL SECURITY;

-- Note: For a quick start template, we allow authenticated users to perform operations.
-- For production, you should refine these policies based on your exact security requirements.

-- Users: Read all, update self
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Products: Read all, CRUD own products
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Users can insert own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Users can update own products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Users can delete own products" ON public.products FOR DELETE USING (auth.uid() = seller_id);

-- Orders: CRUD based on buyer or seller (simplified)
CREATE POLICY "Users can view their orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Users can update their orders" ON public.orders FOR UPDATE USING (auth.uid() = buyer_id);

-- Messages: Sender and Receiver can view/update
CREATE POLICY "Users can view their messages" ON public.messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their messages" ON public.messages FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ==========================================
-- STORAGE BUCKETS
-- ==========================================

-- Create storage buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('slip-images', 'slip-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('refund-evidence', 'refund-evidence', true) ON CONFLICT (id) DO NOTHING;

-- Storage Policies (Simplified public access)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('product-images', 'slip-images', 'refund-evidence'));
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can update own uploads" ON storage.objects FOR UPDATE USING (auth.uid() = owner);
CREATE POLICY "Users can delete own uploads" ON storage.objects FOR DELETE USING (auth.uid() = owner);
