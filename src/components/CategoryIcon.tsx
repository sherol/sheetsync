import React from 'react';
import {
  Film,
  Pill,
  Camera,
  Smile,
  ChefHat,
  FolderKanban,
  Users,
  Presentation,
  Lightbulb,
  HandHeart,
  LucideIcon,
} from 'lucide-react';
import { CategoryIcon as CategoryIconName } from '../types';

const ICONS: Record<CategoryIconName, LucideIcon> = {
  media: Film,
  food: Pill,
  memories: Camera,
  mood: Smile,
  recipes: ChefHat,
  projects: FolderKanban,
  people: Users,
  presentations: Presentation,
  ideas: Lightbulb,
  prayer: HandHeart,
};

export const CategoryIcon: React.FC<{ name: CategoryIconName; className?: string; color?: string }> = ({
  name,
  className = 'w-4 h-4',
  color,
}) => {
  const Icon = ICONS[name] ?? Lightbulb;
  return <Icon className={className} style={color ? { color } : undefined} />;
};
