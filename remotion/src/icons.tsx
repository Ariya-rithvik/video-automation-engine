// Icon registry — maps icon name strings (from Gemini's plan) to Lucide React components.
// Director can name any of these in floatingCards[*].icon; renderer picks Sparkles as fallback.

import React from 'react';
import {
  Calendar, Download, GraduationCap, ShoppingCart, ShoppingBag, Star, Clock, Users,
  Zap, Award, Heart, Coffee, Phone, Camera, Music, Film, MapPin, MessageSquare,
  Search, Settings, ShieldCheck, Truck, Package, ChefHat, Pizza, UtensilsCrossed,
  Briefcase, CreditCard, DollarSign, TrendingUp, Sparkles, ThumbsUp, Gift,
  Globe, Mail, Bell, BookOpen, Bookmark, Headphones, PlayCircle, Image as ImageIcon,
  Video, Mic, Send, CheckCircle2, ArrowRight, Bike, Car, Plane, Home, Building,
  Flame, Cloud, Sun, Moon, type LucideIcon,
} from 'lucide-react';

export const ICON_REGISTRY: Record<string, LucideIcon> = {
  // food & delivery
  Pizza, ChefHat, UtensilsCrossed, Coffee, Truck, Package, Bike,
  ShoppingCart, ShoppingBag, Gift,

  // people & community
  Users, Heart, ThumbsUp, MessageSquare, Bell,

  // business & money
  Briefcase, CreditCard, DollarSign, TrendingUp, Award, ShieldCheck,

  // time & places
  Calendar, Clock, MapPin, Home, Building, Globe, Plane, Car,

  // tech & media
  Phone, Camera, Music, Film, Video, Mic, PlayCircle, ImageIcon, Headphones,
  Download, Mail, Search, Settings, Send,

  // education & content
  GraduationCap, BookOpen, Bookmark,

  // accents
  Sparkles, Star, Zap, CheckCircle2, ArrowRight, Flame, Cloud, Sun, Moon,
};

export const ICON_NAMES = Object.keys(ICON_REGISTRY);

export function getIcon(name: string | undefined): LucideIcon {
  if (name && ICON_REGISTRY[name]) return ICON_REGISTRY[name];
  // Try case-insensitive
  if (name) {
    const found = ICON_NAMES.find(n => n.toLowerCase() === name.toLowerCase());
    if (found) return ICON_REGISTRY[found];
  }
  return Sparkles; // safe fallback
}

interface IconProps {
  name: string | undefined;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({ name, size = 32, color = '#fff', strokeWidth = 2 }) => {
  const LucideIcon = getIcon(name);
  return <LucideIcon size={size} color={color} strokeWidth={strokeWidth} />;
};
