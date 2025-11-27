import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  isImmersive?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, isImmersive = false }) => {
  return (
    <div className={`min-h-screen font-sans flex flex-col max-w-md mx-auto shadow-2xl overflow-hidden relative border-x border-stone-200 transition-colors duration-500 bg-sacred-beige text-stone-800`}>
      <main className={`flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide ${isImmersive ? 'pb-0' : 'pb-20'}`}>
        {children}
      </main>
    </div>
  );
};