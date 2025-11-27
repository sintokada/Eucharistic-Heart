import React from 'react';
import { Home, Flame, BookOpen, MessageCircle, Heart } from 'lucide-react';
import { AppView } from '../types';

interface NavigationProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, onNavigate }) => {
  const navItems = [
    { view: AppView.HOME, icon: Home, label: 'Home' },
    { view: AppView.ADORATION, icon: Flame, label: 'Adore' },
    { view: AppView.CHAT, icon: MessageCircle, label: 'Chat' },
    { view: AppView.MIRACLES, icon: Heart, label: 'Miracles' },
    { view: AppView.PRAYERS, icon: BookOpen, label: 'Pray' },
  ];

  return (
    <div className="absolute bottom-0 w-full max-w-md bg-white border-t border-divine-red/10 pb-safe pt-2 px-2 shadow-lg z-50">
      <div className="flex justify-between items-center px-2 pb-2">
        {navItems.map((item) => {
          const isActive = currentView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ${
                isActive 
                  ? 'text-divine-red transform -translate-y-2' 
                  : 'text-stone-400 hover:text-divine-red/70'
              }`}
            >
              <item.icon 
                size={isActive ? 28 : 24} 
                strokeWidth={isActive ? 2.5 : 2}
                className={isActive ? 'drop-shadow-sm' : ''}
              />
              <span className={`text-[10px] font-medium mt-1 ${isActive ? 'opacity-100' : 'opacity-70'}`}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute -bottom-1 w-1 h-1 bg-divine-red rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};