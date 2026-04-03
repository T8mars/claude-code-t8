import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Layout, 
  RefreshCw, 
  Wrench, 
  Users, 
  Monitor, 
  ShieldCheck, 
  Compass, 
  Star, 
  ChevronRight, 
  ArrowRight,
  Code,
  Zap,
  Lock,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { MANUAL_DATA, Section, Subsection } from './constants';

const ICON_MAP: Record<string, any> = {
  Layout,
  RefreshCw,
  Wrench,
  Users,
  Monitor,
  ShieldCheck,
  Compass,
  Star
};

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollPos = e.currentTarget.scrollTop;
    const height = window.innerHeight;
    const index = Math.round(scrollPos / height);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  const scrollToSlide = (index: number) => {
    containerRef.current?.scrollTo({
      top: index * window.innerHeight,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0d0d0d]">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Global Header / Author Info */}
      <div className="fixed top-10 right-12 z-50 flex items-center gap-5 px-6 py-3 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 via-purple-500 to-blue-600 flex items-center justify-center p-[2px] shadow-[0_0_20px_rgba(239,68,68,0.3)]">
          <div className="w-full h-full rounded-full bg-[#0d0d0d] flex items-center justify-center overflow-hidden">
            <Users className="w-7 h-7 text-white" />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] text-red-400 font-mono font-bold tracking-[0.3em] uppercase mb-1">AUTHOR INFO</span>
          <span className="text-xl font-black text-white glow-text tracking-tight">全网ID：AI代码侠土豆</span>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
        {MANUAL_DATA.map((_, idx) => (
          <button
            key={idx}
            onClick={() => scrollToSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              currentIndex === idx ? 'bg-white h-8' : 'bg-white/20 hover:bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Main PPT Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="snap-container no-scrollbar"
      >
        {MANUAL_DATA.map((section, idx) => (
          <div key={section.id} className="snap-start">
            <Slide section={section} index={idx} />
          </div>
        ))}
      </div>

      {/* Global Footer */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 px-8 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
        <p className="text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
          Claude Code 架构深度解析 • 第 {currentIndex + 1} 页 / 共 {MANUAL_DATA.length} 页
        </p>
      </div>

      {/* Scroll Indicator */}
      <AnimatePresence>
        {currentIndex < MANUAL_DATA.length - 1 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed bottom-12 right-12 z-40 animate-bounce text-white/30"
          >
            <ChevronDown className="w-6 h-6" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Slide({ section, index }: { section: Section; index: number }) {
  const Icon = ICON_MAP[section.icon] || Layout;
  
  return (
    <div className="ppt-slide relative overflow-hidden">
      <div className="max-w-6xl mx-auto w-full">
        {/* Header Area */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          viewport={{ once: false }}
          className="mb-12"
        >
          <div className="flex items-center gap-3 mb-6">
            <span className="badge">架构洞察</span>
            <div className="h-[1px] w-12 bg-white/10" />
            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">模块 {index + 1}</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 glow-text tracking-tight leading-tight">
            {section.title}
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl leading-relaxed">
            {section.content}
          </p>
        </motion.div>

        {/* Process Flow Bar (Inspired by image) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flow-bar flex items-center justify-center gap-8 mb-12 w-fit mx-auto md:mx-0"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
              <Zap className="w-3 h-3" />
            </div>
            输入解析
          </div>
          <ArrowRight className="w-4 h-4 text-white/10" />
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
            <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
              <RefreshCw className="w-3 h-3" />
            </div>
            逻辑编排
          </div>
          <ArrowRight className="w-4 h-4 text-white/10" />
          <div className="flex items-center gap-2 text-xs font-medium text-green-400">
            <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <ShieldCheck className="w-3 h-3" />
            </div>
            安全执行
          </div>
        </motion.div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Side: Summary Cards */}
          <div className="md:col-span-5 space-y-4 overflow-y-auto max-h-[60vh] no-scrollbar pr-2">
            {section.subsections?.map((sub: Subsection, sIdx: number) => (
              <motion.div
                key={sIdx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + (sIdx * 0.1) }}
                className="glass-card p-6 flex gap-4 items-start hover:bg-white/[0.05] transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-red-500/10 transition-colors">
                  <Icon className="w-5 h-5 text-neutral-400 group-hover:text-red-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white/90 mb-1">{sub.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    {sub.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Side: Detailed Table (Inspired by image) */}
          <div className="md:col-span-7">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="glass-card h-full p-8 overflow-y-auto max-h-[60vh] no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                <h4 className="text-xs font-mono text-neutral-500 uppercase tracking-widest">架构细节详情</h4>
                <div className="flex gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500/50" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/50" />
                  <div className="w-2 h-2 rounded-full bg-green-500/50" />
                </div>
              </div>

              <div className="space-y-6">
                {section.subsections?.map((sub: Subsection, sIdx: number) => (
                  <div key={sIdx} className="grid grid-cols-12 gap-4 items-center group">
                    <div className="col-span-4 text-xs font-mono text-neutral-400 group-hover:text-white transition-colors">
                      {sub.title}
                    </div>
                    <div className="col-span-8 text-xs text-neutral-500 leading-relaxed border-l border-white/5 pl-4">
                      {sub.content}
                      {sub.files && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {sub.files.map((file, fIdx) => (
                            <span key={fIdx} className="text-[9px] bg-white/5 px-1.5 py-0.5 rounded text-neutral-400 border border-white/5">
                              {file}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Mock Files if none exist */}
                {!section.subsections?.[0]?.files && (
                  <div className="pt-4 mt-4 border-t border-white/5">
                    <div className="flex items-center gap-2 text-[10px] text-neutral-600 font-mono mb-2">
                      <Code className="w-3 h-3" />
                      相关核心组件
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/5 text-neutral-400">core.ts</span>
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/5 text-neutral-400">engine.tsx</span>
                      <span className="text-[10px] bg-white/5 px-2 py-1 rounded border border-white/5 text-neutral-400">types.d.ts</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
