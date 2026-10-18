import React from 'react';
import {
  Film, Tv, Gamepad2, BookOpen, Book, Music, Headphones, Podcast, Camera, Image, Clapperboard,
  Pill, Apple, Coffee, Utensils, UtensilsCrossed, ChefHat, Pizza, Salad, Wine, Cookie, Soup,
  Smile, Frown, Meh, Heart, HeartPulse, Activity, Brain, Moon, Sun, Cloud, Zap, Flame,
  Dumbbell, Bike, Footprints, Bed, Droplet, Stethoscope, Syringe, Thermometer, Scale,
  FolderKanban, Briefcase, Lightbulb, Rocket, Code, Wrench, Hammer, PenTool, Palette, Puzzle,
  Presentation, FileText, NotebookPen, Newspaper, Mic, GraduationCap, School,
  Users, User, UserRound, Baby, Dog, Cat, House, MapPin, Plane, Car, Globe, Mountain, Trees, Leaf, Flower2,
  Calendar, Clock, Star, Trophy, Target, Flag, Gift, ShoppingCart, Wallet, PiggyBank, DollarSign,
  HandHeart, Church, Cross, Sparkles, Bell, Tag, Bookmark, Shirt,
  LucideIcon,
} from 'lucide-react';

export interface IconGroup {
  label: string;
  icons: Record<string, LucideIcon>;
}

/** Icons offered in the category icon picker, grouped for browsing. */
export const ICON_LIBRARY: IconGroup[] = [
  {
    label: 'Media & Hobbies',
    icons: { film: Film, tv: Tv, gamepad: Gamepad2, book: Book, bookOpen: BookOpen, music: Music, headphones: Headphones, podcast: Podcast, camera: Camera, image: Image, clapperboard: Clapperboard, puzzle: Puzzle, palette: Palette },
  },
  {
    label: 'Food & Drink',
    icons: { utensils: Utensils, utensilsCrossed: UtensilsCrossed, chefHat: ChefHat, apple: Apple, coffee: Coffee, pizza: Pizza, salad: Salad, soup: Soup, cookie: Cookie, wine: Wine },
  },
  {
    label: 'Health & Mood',
    icons: { pill: Pill, stethoscope: Stethoscope, syringe: Syringe, thermometer: Thermometer, heartPulse: HeartPulse, activity: Activity, dumbbell: Dumbbell, bike: Bike, footprints: Footprints, scale: Scale, bed: Bed, droplet: Droplet, smile: Smile, meh: Meh, frown: Frown, brain: Brain, moon: Moon, sun: Sun, cloud: Cloud, zap: Zap, flame: Flame },
  },
  {
    label: 'Work & Ideas',
    icons: { folder: FolderKanban, briefcase: Briefcase, lightbulb: Lightbulb, rocket: Rocket, code: Code, wrench: Wrench, hammer: Hammer, penTool: PenTool, presentation: Presentation, fileText: FileText, notebook: NotebookPen, newspaper: Newspaper, mic: Mic, graduationCap: GraduationCap, school: School, target: Target, trophy: Trophy, flag: Flag },
  },
  {
    label: 'People & Places',
    icons: { users: Users, user: User, userRound: UserRound, baby: Baby, dog: Dog, cat: Cat, house: House, mapPin: MapPin, plane: Plane, car: Car, globe: Globe, mountain: Mountain, trees: Trees, leaf: Leaf, flower: Flower2 },
  },
  {
    label: 'Faith & Life',
    icons: { handHeart: HandHeart, church: Church, cross: Cross, heart: Heart, sparkles: Sparkles, star: Star, gift: Gift, calendar: Calendar, clock: Clock, bell: Bell, tag: Tag, bookmark: Bookmark, shirt: Shirt, shoppingCart: ShoppingCart, wallet: Wallet, piggyBank: PiggyBank, dollar: DollarSign },
  },
];

const ALL_ICONS: Record<string, LucideIcon> = Object.assign({}, ...ICON_LIBRARY.map((g) => g.icons));

// Names used by the original built-in categories.
const LEGACY_NAMES: Record<string, string> = {
  media: 'film',
  food: 'pill',
  memories: 'camera',
  mood: 'smile',
  recipes: 'chefHat',
  projects: 'folder',
  people: 'users',
  presentations: 'presentation',
  ideas: 'lightbulb',
  prayer: 'handHeart',
};

export function resolveIcon(name: string): LucideIcon {
  return ALL_ICONS[name] ?? ALL_ICONS[LEGACY_NAMES[name]] ?? Lightbulb;
}

export const CategoryIcon: React.FC<{ name: string; className?: string; color?: string }> = ({
  name,
  className = 'w-4 h-4',
  color,
}) => {
  const Icon = resolveIcon(name);
  return <Icon className={className} style={color ? { color } : undefined} />;
};
