import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Navigation } from './components/Navigation';
import { AppView, ChatMessage } from './types';
import { MIRACLES_DATA, PRAYERS_DATA, ADORATION_SCRIPTURES, HOLY_HOUR_DISPLAY_TEXT, HOLY_HOUR_SPEECH_TEXT } from './constants';
import { sendMessage, generateSpeech, convertPCMToAudioBuffer } from './services/geminiService';
import { Play, Pause, RefreshCw, Send, Sparkles, ChevronRight, ChevronLeft, Clock, MapPin, Flame, MessageCircle, Heart, BookOpen, Volume2, X, Gauge } from 'lucide-react';

// Custom Logo Component: Eucharistic Monstrance with Ruby Heart
const EucharisticLogo = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    {/* Sunburst Rays */}
    <g transform="translate(50, 45)">
       {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
         <line 
            key={deg} 
            x1="0" y1="0" x2="0" y2="-42" 
            transform={`rotate(${deg})`} 
            stroke="#F59E0B" 
            strokeWidth={i % 2 === 0 ? "4" : "2"} 
            strokeLinecap="round"
         />
       ))}
    </g>

    {/* Modern Flat Stand */}
    <path d="M35 92 L65 92 L60 84 L40 84 Z" fill="#B45309" /> 
    <rect x="47" y="68" width="6" height="16" fill="#B45309" /> 
    {/* Cradle */}
    <path d="M38 65 Q 50 78 62 65" stroke="#F59E0B" strokeWidth="4" fill="none" strokeLinecap="round" />

    {/* Ruby Red Heart */}
    <path d="M50 78 C 22 55 12 35 30 20 A 15 15 0 0 1 50 34 A 15 15 0 0 1 70 20 C 88 35 78 55 50 78 Z" 
          fill="#991B1B" />

    {/* Host - White Center */}
    <circle cx="50" cy="45" r="13" fill="#FFFFFF" />
    
    {/* Cross on Host - Gold */}
    <path d="M50 36 L50 54 M42 45 L58 45" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.HOME);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Adoration Timer State
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes
  const [timerDuration, setTimerDuration] = useState(30 * 60);

  // Scripture State
  const [scriptureIndex, setScriptureIndex] = useState(0);

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  // Prayers & Miracles State
  const [selectedPrayer, setSelectedPrayer] = useState<string | null>(null);
  const [selectedMiracle, setSelectedMiracle] = useState<string | null>(null);

  // Chat scroll ref
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, currentView]);

  useEffect(() => {
    let interval: number | undefined;
    if (timerActive && timeLeft > 0) {
      interval = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setTimerActive(false);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Update playback rate dynamically
  useEffect(() => {
    if (audioSourceRef.current) {
        audioSourceRef.current.playbackRate.value = playbackRate;
    }
  }, [playbackRate]);

  // Rotate scripture every minute if timer is active
  useEffect(() => {
    if (timerActive && timeLeft > 0 && timeLeft % 60 === 0 && timeLeft !== timerDuration) {
      setScriptureIndex(prev => (prev + 1) % ADORATION_SCRIPTURES.length);
    }
  }, [timeLeft, timerActive, timerDuration]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {
        // Ignore if already stopped
      }
      audioSourceRef.current = null;
    }
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current.currentTime = 0;
    }
    
    setIsPlayingAudio(false);
  };

  const playHolyHourAudio = async () => {
    setAudioLoading(true);
    
    // Initialize Audio Context immediately on user gesture
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    }
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }
    
    // 1. Start Background Music (Adoro Te Devote MP3)
    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio("https://archive.org/download/AdoroTeDevote/Adoro%20Te%20Devote.mp3");
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.3; 
    }
    bgMusicRef.current.play().catch(e => console.error("BG music failed:", e));

    // 2. Generate and Play Speech
    const pcmData = await generateSpeech(HOLY_HOUR_SPEECH_TEXT);
    if (pcmData) {
      const buffer = await convertPCMToAudioBuffer(pcmData, audioContextRef.current);
      
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate; // Set initial speed
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
         setIsPlayingAudio(false);
         if(bgMusicRef.current) bgMusicRef.current.pause();
      };
      source.start();
      audioSourceRef.current = source;
      setIsPlayingAudio(true);
    }

    setAudioLoading(false);
  };

  const handleSendMessage = async (textOverride?: string) => {
    const messageToSend = textOverride || inputMessage;
    if (!messageToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: messageToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textOverride) setInputMessage('');
    setIsTyping(true);

    // INTERCEPT: Start Holy Hour
    if (messageToSend.toLowerCase().includes("start holy hour")) {
       setIsTyping(false);
       stopAudio();

       const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: HOLY_HOUR_DISPLAY_TEXT,
          timestamp: new Date(),
       };
       setMessages((prev) => [...prev, aiMsg]);
       
       playHolyHourAudio();
       return;
    }

    const responseText = await sendMessage(messageToSend);

    const aiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: responseText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleQuickAction = (text: string) => {
    setCurrentView(AppView.CHAT);
    handleSendMessage(text);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const nextScripture = () => {
    setScriptureIndex(prev => (prev + 1) % ADORATION_SCRIPTURES.length);
  };

  const toggleAdorationSession = () => {
    if (timerActive) {
        setTimerActive(false);
        stopAudio();
    } else {
        setTimerActive(true);
        playHolyHourAudio();
    }
  };
  
  const toggleSpeed = () => {
      const speeds = [1.0, 1.25, 1.5, 0.75];
      const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
      setPlaybackRate(speeds[nextIdx]);
  };

  // Helper function to render text with clickable links and formatted bold text
  const renderFormattedMessage = (text: string) => {
    // 1. Split by URL
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all font-medium"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      
      // 2. Process text for bolding (**text**)
      const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={index}>
          {boldParts.map((subPart, subIndex) => {
             if (subPart.startsWith('**') && subPart.endsWith('**')) {
                 return <strong key={subIndex} className="font-bold">{subPart.slice(2, -2)}</strong>;
             }
             return subPart;
          })}
        </span>
      );
    });
  };

  // --- VIEW RENDER FUNCTIONS ---

  const renderHomeView = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-sacred-beige to-white">
      {/* Hero */}
      <div className="bg-divine-red text-sacred-beige p-8 rounded-b-[40px] shadow-xl relative overflow-hidden min-h-[180px]">
        {/* Custom Logo Placed on Right */}
        <div className="absolute -right-6 -top-4 opacity-90 transform rotate-6">
            <EucharisticLogo className="w-48 h-48 drop-shadow-2xl" />
        </div>
        
        <div className="relative z-10 mt-6 max-w-[65%]">
            <h1 className="text-4xl font-serif font-bold mb-2 leading-tight">Eucharistic Heart</h1>
            <h2 className="text-xl font-light text-radiant-gold italic mb-6">Companion</h2>
            <div className="flex items-center space-x-2 bg-black/20 w-fit px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
                <Sparkles size={16} className="text-radiant-gold" />
                <span className="text-sm font-semibold tracking-wide uppercase">Adore. Unite. Radiate.</span>
            </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => setCurrentView(AppView.ADORATION)}
                className="col-span-2 bg-gradient-to-r from-radiant-gold to-orange-400 p-5 rounded-2xl shadow-lg hover:shadow-xl transition-all active:scale-95 group text-left relative overflow-hidden"
            >
                <div className="absolute right-0 bottom-0 opacity-20 transform translate-x-4 translate-y-4">
                    <Clock size={80} className="text-white" />
                </div>
                <h3 className="text-white font-bold text-2xl mb-1">Start Holy Hour</h3>
                <p className="text-white/90 text-sm">30 min guided adoration 🔥</p>
                <div className="mt-4 inline-flex items-center bg-white/20 px-3 py-1 rounded-full text-white text-xs font-bold">
                    Let's go <ChevronRight size={14} className="ml-1" />
                </div>
            </button>

            {/* Adoration Finder Button */}
            <button 
                onClick={() => handleQuickAction("Find adoration near me")}
                className="col-span-2 bg-white p-4 rounded-2xl shadow-md border border-stone-100 active:scale-95 transition-all flex items-center space-x-4 group"
            >
                <div className="bg-divine-red/10 w-12 h-12 rounded-full flex items-center justify-center text-divine-red group-hover:bg-divine-red group-hover:text-white transition-colors">
                    <MapPin size={24} />
                </div>
                <div className="text-left flex-1">
                    <h3 className="text-stone-800 font-bold text-lg">Find a Chapel</h3>
                    <p className="text-stone-500 text-xs">Jesus is waiting nearby 📍</p>
                </div>
                <div className="bg-stone-100 rounded-full p-1">
                    <ChevronRight size={16} className="text-stone-400" />
                </div>
            </button>

            <button 
                onClick={() => setCurrentView(AppView.CHAT)}
                className="bg-white p-5 rounded-2xl shadow-md border border-stone-100 active:scale-95 transition-all"
            >
                <div className="bg-divine-red/10 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-divine-red">
                    <MessageCircle size={20} />
                </div>
                <h3 className="text-stone-800 font-bold text-lg">Chat</h3>
                <p className="text-stone-500 text-xs mt-1">Ask the Companion</p>
            </button>

            <button 
                onClick={() => setCurrentView(AppView.MIRACLES)}
                className="bg-white p-5 rounded-2xl shadow-md border border-stone-100 active:scale-95 transition-all"
            >
                <div className="bg-divine-red/10 w-10 h-10 rounded-full flex items-center justify-center mb-3 text-divine-red">
                    <Heart size={20} />
                </div>
                <h3 className="text-stone-800 font-bold text-lg">Miracles</h3>
                <p className="text-stone-500 text-xs mt-1">Mind-blowing facts</p>
            </button>
        </div>

        {/* Daily Inspiration */}
        <div className="bg-stone-50 border border-stone-200 p-5 rounded-2xl">
            <h4 className="text-divine-red font-bold text-sm uppercase tracking-wider mb-2 flex items-center">
                <Flame size={14} className="mr-2" /> Daily Fire
            </h4>
            <p className="text-stone-700 italic font-serif leading-relaxed">
                "The Eucharist is my highway to heaven."
            </p>
            <p className="text-right text-stone-500 text-xs mt-2 font-bold">— Bl. Carlo Acutis</p>
        </div>
      </div>
    </div>
  );

  const renderAdorationView = () => {
    const currentScripture = ADORATION_SCRIPTURES[scriptureIndex];

    return (
      <div className="flex flex-col h-full bg-sacred-beige text-stone-800 relative overflow-hidden">
          {/* Background ambience (Light Mode) */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-sacred-beige to-stone-100"></div>
          
          <div className="relative z-10 flex flex-col h-full p-6 overflow-y-auto scrollbar-hide">
              <div className="flex justify-between items-center mb-6 shrink-0">
                  <h2 className="text-2xl font-serif font-bold text-divine-red">Holy Hour</h2>
                  <div className="bg-divine-red/10 text-divine-red px-3 py-1 rounded-full text-xs font-mono font-bold">
                      {formatTime(timeLeft)}
                  </div>
              </div>

              {/* Monstrance Visual */}
              <div className="flex-1 flex flex-col items-center justify-center shrink-0 min-h-[300px]">
                  <div className={`relative transition-all duration-1000 ${timerActive ? 'scale-110' : 'scale-100'}`}>
                      {/* Custom Sacred Glow Animation - Darker for Light BG */}
                      <div className="absolute -inset-4 bg-radiant-gold/40 blur-3xl rounded-full animate-sacred-glow"></div>
                      <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-full animate-pulse"></div>

                      <div className="w-48 h-48 rounded-full border-4 border-radiant-gold flex items-center justify-center bg-white shadow-[0_0_50px_rgba(245,158,11,0.4)] relative z-10">
                          <div className="w-32 h-32 rounded-full bg-sacred-beige flex items-center justify-center shadow-inner relative overflow-hidden border border-stone-100">
                              {/* Inner Host Texture */}
                              <div className="absolute inset-0 bg-gradient-to-tr from-white to-stone-50 opacity-100"></div>
                              
                              {/* Pulsing Sacred Heart Visual */}
                              <div className="absolute inset-0 flex items-center justify-center">
                                  <Heart 
                                    size={48} 
                                    className="text-divine-red/30 fill-divine-red/20 animate-heartbeat" 
                                    strokeWidth={1.5}
                                  />
                              </div>
                              
                              {/* Cross Overlay */}
                              <span className="text-stone-400 text-4xl opacity-40 font-light relative z-10">✝</span>
                          </div>
                      </div>
                  </div>
                  
                  <p className="mt-8 text-center text-stone-600 max-w-xs font-light">
                      {timerActive ? "He is looking at you, and you are looking at Him." : "Be still. He is literally waiting for you."}
                  </p>

                  {/* Static Scripture Section (Subtitles Removed) */}
                  <div className="w-full max-w-xs mt-6 min-h-[120px] flex items-center justify-center relative group">
                        <div className="bg-white/60 backdrop-blur-md rounded-xl p-4 border border-divine-red/10 text-center animate-fade-in w-full shadow-sm">
                            <button 
                                onClick={nextScripture}
                                className="absolute top-2 right-2 text-stone-400 hover:text-divine-red transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <RefreshCw size={12} />
                            </button>
                            <div className="flex justify-center mb-2 text-divine-red opacity-80">
                                <BookOpen size={16} />
                            </div>
                            <p className="text-stone-800 font-serif italic text-sm mb-2 leading-relaxed">
                                "{currentScripture.text}"
                            </p>
                            <p className="text-xs text-divine-red font-bold tracking-wide uppercase">
                                {currentScripture.reference}
                            </p>
                        </div>
                  </div>
              </div>

              {/* Controls */}
              <div className="mt-8 mb-20 space-y-4 shrink-0">
                  <div className="flex justify-center space-x-6 items-center">
                       {/* Speed Control Button */}
                      <button 
                        onClick={toggleSpeed}
                        className="bg-stone-100 text-stone-500 rounded-full w-14 h-14 flex flex-col items-center justify-center border border-stone-200 hover:bg-stone-200 transition-colors text-xs font-bold"
                      >
                         <Gauge size={18} className="mb-0.5" />
                         {playbackRate}x
                      </button>

                      <button 
                          onClick={toggleAdorationSession}
                          className={`rounded-full w-20 h-20 flex items-center justify-center shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                            timerActive 
                                ? 'bg-divine-red text-white' 
                                : 'bg-radiant-gold text-stone-900 hover:bg-amber-400'
                          }`}
                      >
                          {audioLoading ? (
                             <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                             timerActive ? <Pause size={32} fill="currentColor" /> : <Play size={32} fill="currentColor" className="ml-1" />
                          )}
                      </button>
                      <button 
                          onClick={() => {
                              setTimerActive(false);
                              stopAudio();
                              setTimeLeft(timerDuration);
                          }}
                          className="bg-stone-100 text-stone-500 rounded-full w-14 h-14 flex items-center justify-center border border-stone-200 hover:bg-stone-200 transition-colors"
                      >
                          <RefreshCw size={20} />
                      </button>
                  </div>
                  
                  <div className="flex justify-between text-xs text-stone-400 px-4">
                      <button onClick={() => { setTimerDuration(15*60); setTimeLeft(15*60); }} className={timerDuration === 900 ? "text-divine-red font-bold" : ""}>15m</button>
                      <button onClick={() => { setTimerDuration(30*60); setTimeLeft(1800); }} className={timerDuration === 1800 ? "text-divine-red font-bold" : ""}>30m</button>
                      <button onClick={() => { setTimerDuration(60*60); setTimeLeft(3600); }} className={timerDuration === 3600 ? "text-divine-red font-bold" : ""}>60m</button>
                  </div>
              </div>
          </div>
          
           {/* Exit Button */}
           <div className="absolute bottom-4 left-0 right-0 flex justify-center z-50">
                <button 
                    onClick={() => {
                        stopAudio();
                        setTimerActive(false);
                        setCurrentView(AppView.HOME);
                    }}
                    className="bg-divine-red/10 backdrop-blur-md text-divine-red px-6 py-2 rounded-full text-sm font-bold hover:bg-divine-red/20 transition-colors border border-divine-red/20"
                >
                    Exit Holy Hour
                </button>
           </div>
      </div>
    );
  };

  const renderPrayersView = () => {
    // Detail View
    if (selectedPrayer) {
        const prayer = PRAYERS_DATA.find(p => p.id === selectedPrayer);
        if (!prayer) return null;
        
        return (
            <div className="flex flex-col h-full bg-sacred-beige">
                <div className="bg-white px-4 py-4 border-b border-stone-100 sticky top-0 z-10 flex items-center">
                    <button 
                        onClick={() => setSelectedPrayer(null)}
                        className="p-2 -ml-2 text-stone-500 hover:text-divine-red transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="ml-2 font-bold text-stone-800 text-lg truncate flex-1">{prayer.title}</h2>
                </div>
                <div className="p-6 overflow-y-auto pb-24">
                    <div className="max-w-prose mx-auto">
                         <h1 className="text-2xl font-serif font-bold text-divine-red mb-6">{prayer.title}</h1>
                         <div className="prose prose-stone prose-lg">
                             <p className="whitespace-pre-wrap font-serif leading-loose text-stone-700">
                                 {prayer.content}
                             </p>
                         </div>
                         <div className="mt-12 flex justify-center">
                            <Sparkles className="text-radiant-gold opacity-50" size={20} />
                         </div>
                    </div>
                </div>
            </div>
        );
    }

    // List View
    return (
      <div className="flex flex-col h-full bg-stone-50">
          <div className="p-6 pb-4 bg-white border-b border-stone-100">
             <h1 className="text-3xl font-serif font-bold text-stone-900">Prayers</h1>
             <p className="text-stone-500 mt-1">Eucharistic & Sacred Heart Devotions</p>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto pb-24">
              {PRAYERS_DATA.map((prayer, index) => (
                  <button 
                    key={prayer.id}
                    onClick={() => setSelectedPrayer(prayer.id)}
                    className="w-full bg-white p-5 rounded-2xl border border-stone-100 shadow-sm hover:shadow-md transition-all active:scale-[0.99] flex items-center text-left group"
                  >
                      <div className="w-10 h-10 rounded-full bg-divine-red/5 text-divine-red font-serif font-bold flex items-center justify-center mr-4 group-hover:bg-divine-red group-hover:text-white transition-colors shrink-0">
                          {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-stone-800 text-lg truncate group-hover:text-divine-red transition-colors">{prayer.title}</h3>
                          {prayer.content.includes('\n') && (
                            <p className="text-stone-400 text-xs truncate mt-1">
                                {prayer.content.split('\n')[0].substring(0, 40)}...
                            </p>
                          )}
                      </div>
                      <ChevronRight size={20} className="text-stone-300 group-hover:text-divine-red ml-2" />
                  </button>
              ))}
          </div>
      </div>
    );
  };

  const renderMiraclesView = () => {
    // Detail View
    if (selectedMiracle) {
        const miracle = MIRACLES_DATA.find(m => m.id === selectedMiracle);
        if (!miracle) return null;

        return (
             <div className="flex flex-col h-full bg-sacred-beige">
                <div className="bg-white px-4 py-4 border-b border-stone-100 sticky top-0 z-10 flex items-center">
                    <button 
                        onClick={() => setSelectedMiracle(null)}
                        className="p-2 -ml-2 text-stone-500 hover:text-divine-red transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h2 className="ml-2 font-bold text-stone-800 text-lg truncate flex-1">{miracle.location}</h2>
                </div>
                
                <div className="overflow-y-auto pb-24">
                     {/* Image Placeholder header - styled for miracle */}
                    <div className="h-48 bg-divine-red/10 w-full relative overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10"></div>
                        <Heart className="text-divine-red opacity-20 w-32 h-32 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                        <div className="absolute bottom-4 left-6 z-20">
                             <div className="flex items-center space-x-2 text-radiant-gold text-xs font-bold uppercase tracking-widest mb-1">
                                <MapPin size={12} />
                                <span>{miracle.location.toUpperCase()}</span>
                             </div>
                             <h1 className="text-2xl font-serif font-bold text-white leading-tight drop-shadow-md">
                                The Miracle of {miracle.title.split(',')[0]}
                             </h1>
                        </div>
                    </div>

                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <span className="bg-stone-100 text-stone-600 px-3 py-1 rounded-full text-xs font-bold">
                                {miracle.date}
                            </span>
                        </div>

                        <div className="prose prose-stone">
                             <p className="font-serif text-lg leading-relaxed text-stone-800 mb-6 first-letter:text-5xl first-letter:font-bold first-letter:text-divine-red first-letter:mr-1 first-letter:float-left">
                                {miracle.fullStory || miracle.description}
                             </p>
                             
                             <div className="bg-divine-red/5 border border-divine-red/10 rounded-xl p-5 my-8">
                                <h4 className="text-divine-red font-bold text-sm uppercase mb-2 flex items-center">
                                    <Sparkles size={14} className="mr-2" /> Scientific Fact
                                </h4>
                                <p className="text-divine-red/80 italic font-serif">
                                    "{miracle.science}"
                                </p>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // List View
    return (
      <div className="flex flex-col h-full bg-stone-50">
        <div className="p-6 pb-4 bg-white border-b border-stone-100 sticky top-0 z-10">
             <h1 className="text-3xl font-serif font-bold text-stone-900">Eucharistic Miracles</h1>
             <p className="text-stone-500 mt-1">Scientific evidence of the impossible.</p>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto pb-24">
          {/* Intro Card */}
          <div className="bg-white p-5 rounded-2xl border border-stone-100 shadow-sm">
             <p className="text-stone-600 text-sm leading-relaxed mb-3">
                 Over 150 Church-approved miracles exist where the Host transformed into visible flesh and blood—often type AB, matching the Shroud of Turin.
             </p>
             <p className="text-stone-600 text-sm leading-relaxed">
                 These are not myths. They are <span className="font-bold text-divine-red">divine signs</span> verified by modern science.
             </p>
          </div>

          {MIRACLES_DATA.map((miracle) => (
            <button 
                key={miracle.id}
                onClick={() => setSelectedMiracle(miracle.id)}
                className="w-full bg-white rounded-2xl border border-stone-100 shadow-sm hover:shadow-lg transition-all active:scale-[0.99] overflow-hidden group text-left"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-stone-800 group-hover:text-divine-red transition-colors">
                        {miracle.title}
                    </h3>
                    <span className="bg-radiant-lightGold text-amber-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                        {miracle.date}
                    </span>
                </div>
                <p className="text-stone-500 text-sm leading-relaxed mb-4">
                    {miracle.description}
                </p>
                <div className="flex items-center text-divine-red text-xs font-bold font-sans">
                    Read story <ChevronRight size={14} className="ml-1" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderChatView = () => (
      <div className="flex flex-col h-full bg-stone-50">
        <div className="bg-white border-b border-stone-200 p-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
            <div>
                <h1 className="text-lg font-bold text-stone-800 flex items-center">
                    <span className="bg-divine-red text-white p-1 rounded mr-2"><Flame size={14} /></span>
                    Companion
                </h1>
            </div>
            {/* Audio Controls if playing in background during chat */}
            {isPlayingAudio && (
                 <div className="flex items-center bg-radiant-gold/10 px-3 py-1 rounded-full">
                     <Volume2 size={14} className="text-radiant-gold mr-2 animate-pulse" />
                     <button onClick={stopAudio} className="text-xs font-bold text-stone-600 hover:text-divine-red">Stop</button>
                 </div>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {messages.length === 0 && (
            <div className="text-center mt-12 opacity-50">
              <div className="bg-stone-200 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                 <MessageCircle size={40} className="text-stone-400" />
              </div>
              <p className="text-stone-500 font-medium">Start a conversation...</p>
              
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                  <button onClick={() => handleQuickAction("Start Holy Hour")} className="bg-white border border-stone-200 px-4 py-2 rounded-full text-xs font-bold text-stone-600 hover:bg-divine-red hover:text-white transition-colors">Start Holy Hour</button>
                  <button onClick={() => handleQuickAction("Find adoration near me")} className="bg-white border border-stone-200 px-4 py-2 rounded-full text-xs font-bold text-stone-600 hover:bg-divine-red hover:text-white transition-colors">Find Adoration</button>
                  <button onClick={() => handleQuickAction("Tell me a miracle")} className="bg-white border border-stone-200 px-4 py-2 rounded-full text-xs font-bold text-stone-600 hover:bg-divine-red hover:text-white transition-colors">Miracles</button>
              </div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-divine-red text-white rounded-br-none'
                    : 'bg-white text-stone-800 border border-stone-100 rounded-bl-none'
                }`}
              >
                {msg.role === 'model' ? renderFormattedMessage(msg.text) : msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-stone-100 p-4 rounded-2xl rounded-bl-none shadow-sm flex items-center space-x-2">
                 <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                 <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                 <div className="w-2 h-2 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white p-4 border-t border-stone-200 fixed bottom-0 w-full max-w-md z-20 mb-[60px]"> {/* Adjusted margin for navigation */}
          <div className="flex items-center space-x-2 bg-stone-50 p-2 rounded-full border border-stone-200 focus-within:ring-2 focus-within:ring-divine-red/20 transition-all">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask for prayer, miracles, or a chapel..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-stone-800 placeholder-stone-400 px-3 text-sm"
              disabled={isTyping}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isTyping || !inputMessage.trim()}
              className={`p-2 rounded-full transition-all ${
                inputMessage.trim() 
                    ? 'bg-divine-red text-white shadow-md transform hover:scale-105' 
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
  );

  return (
    <Layout isImmersive={currentView === AppView.ADORATION}>
      {currentView === AppView.HOME && renderHomeView()}
      {currentView === AppView.ADORATION && renderAdorationView()}
      {currentView === AppView.CHAT && renderChatView()}
      {currentView === AppView.MIRACLES && renderMiraclesView()}
      {currentView === AppView.PRAYERS && renderPrayersView()}
      
      {currentView !== AppView.ADORATION && (
        <Navigation currentView={currentView} onNavigate={setCurrentView} />
      )}
    </Layout>
  );
};

export default App;