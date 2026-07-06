import React from 'react';
import { ArrowRight, UserCheck, LayoutDashboard, Settings as SettingsIcon, AlertCircle } from 'lucide-react';
import { DemoItem } from '../types';

interface LiveMapProps {
  demos: DemoItem[];
  selectedDemoId: string | null;
  onSelectDemo: (demoId: string) => void;
  activeStepName: string;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  demos,
  selectedDemoId,
  onSelectDemo,
  activeStepName,
}) => {
  // Pre-configured architectural layout mapping
  const stepsConfig = [
    {
      key: 'Authentication',
      label: 'Authentication',
      icon: UserCheck,
      color: 'from-blue-500 to-indigo-500',
      description: 'MFA & OAuth Login Layer',
    },
    {
      key: 'Main Dashboard',
      label: 'Main Feature',
      icon: LayoutDashboard,
      color: 'from-purple-500 to-indigo-500',
      description: 'Analytics & WebSockets',
    },
    {
      key: 'Advanced Settings',
      label: 'Settings',
      icon: SettingsIcon,
      color: 'from-pink-500 to-rose-500',
      description: 'System Config Alert',
    },
  ];

  return (
    <div className="bg-glass-heavy rounded-2xl p-6 border border-slate-800 shadow-xl max-w-4xl mx-auto my-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-white tracking-wide">Interactive App Blueprint</h3>
        <p className="text-xs text-slate-400">
          Click an architectural node below to immediately play its verified 10-second functional demo loop.
        </p>
      </div>

      <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 py-4">
        
        {/* Background connector line (SVG) for high fidelity */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 hidden md:block -translate-y-1/2 -z-10"></div>

        {stepsConfig.map((step, idx) => {
          // Find matching demo in loaded dataset
          const matchingDemo = demos.find(
            (d) => d.stepName.toLowerCase() === step.key.toLowerCase() ||
                   (step.key === 'Authentication' && d.stepName.includes('Auth')) ||
                   (step.key === 'Main Dashboard' && d.stepName.includes('Dashboard')) ||
                   (step.key === 'Advanced Settings' && d.stepName.includes('Settings'))
          );

          const isNodeActive = activeStepName.toLowerCase() === step.key.toLowerCase() ||
                               (step.key === 'Authentication' && activeStepName.includes('Auth')) ||
                               (step.key === 'Main Dashboard' && activeStepName.includes('Dashboard')) ||
                               (step.key === 'Advanced Settings' && activeStepName.includes('Settings'));

          const isSelected = selectedDemoId && matchingDemo && selectedDemoId === matchingDemo.id;
          const Icon = step.icon;

          return (
            <React.Fragment key={step.key}>
              <button
                onClick={() => matchingDemo && onSelectDemo(matchingDemo.id)}
                disabled={!matchingDemo}
                className={`relative flex-1 w-full md:w-auto text-left p-4 rounded-xl border transition-all duration-300 ${
                  isSelected
                    ? 'bg-slate-900 border-brand-500 shadow-[0_0_15px_rgba(0,102,255,0.25)] translate-y-[-2px]'
                    : isNodeActive
                    ? 'bg-slate-950/80 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.15)]'
                    : matchingDemo
                    ? 'bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-950/60'
                    : 'bg-slate-950/20 border-slate-900 opacity-40 cursor-not-allowed'
                }`}
              >
                {/* Node Active glowing border ring */}
                {isNodeActive && (
                  <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-brand-500 to-indigo-500 opacity-40 blur-[2px] animate-pulse -z-10"></div>
                )}

                <div className="flex items-center space-x-3.5">
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${step.color} text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sm font-bold text-slate-100">{step.label}</span>
                      {matchingDemo && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 block mt-0.5">{step.description}</span>
                  </div>
                </div>

                {!matchingDemo && (
                  <div className="absolute top-2 right-2 text-slate-500 flex items-center space-x-1 text-[10px] font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>No data</span>
                  </div>
                )}
              </button>

              {idx < stepsConfig.length - 1 && (
                <div className="text-slate-600 md:hidden">
                  <ArrowRight className="w-5 h-5 rotate-90" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
