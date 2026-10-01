import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserRole } from '../types';
import { Sparkles, X, Send, ArrowRight } from 'lucide-react';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'copilot';
  text: string;
  actionButton?: { label: string; path: string };
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({
  isOpen,
  onClose,
  currentRole,
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'copilot',
      text: `Hello ${currentRole}! I am the SchoolPath AI Copilot (Section 20.5). You can ask me to find school records, check confidence scores, or inspect extraction jobs.`,
    },
  ]);
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputValue;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text,
    };

    const lower = text.toLowerCase();
    let replyText = '';
    let actionButton: { label: string; path: string } | undefined;

    if (lower.includes('abc') || lower.includes('open seats') || lower.includes('confidence')) {
      replyText =
        'ABC Academy (SCH001) Grade 1 Open Seats has a winning value of 12 with 82.5% confidence. Routed to Mandatory HITL Review due to conflict with GreatSchools Aggregator (8).';
      actionButton = { label: 'Open in Review Queue', path: '/review' };
    } else if (lower.includes('job') || lower.includes('fail') || lower.includes('crawl')) {
      replyText =
        'There is 1 failed crawl job (JOB-2026-0144, MetadataAgent) due to a 504 gateway timeout. 1 job is currently Running.';
      actionButton = { label: 'View Job Monitor', path: '/jobs' };
    } else if (lower.includes('school') || lower.includes('invalid')) {
      replyText =
        'There are 6 schools in the master library. 1 school (Oak Hills STEM Charter) is marked Invalid due to an unresolvable URL.';
      actionButton = { label: 'Open School Library', path: '/schools' };
    } else if (lower.includes('source') || lower.includes('rank') || lower.includes('weight')) {
      replyText =
        'Official School Websites are Cat 1 (100 baseline, 87.5 effective). Aggregators are Cat 3 (40 baseline, drifting down to 16.8).';
      actionButton = { label: 'Inspect Source Ranking', path: '/ranking' };
    } else {
      replyText =
        `Understood. I can execute operations within your ${currentRole} permissions. Please select a quick action or specify an entity.`;
    }

    const copilotMsg: ChatMessage = {
      id: `c-${Date.now()}`,
      sender: 'copilot',
      text: replyText,
      actionButton,
    };

    setMessages((prev) => [...prev, userMsg, copilotMsg]);
    setInputValue('');
  };

  const sampleQuestions = [
    'Show confidence for ABC Academy',
    'Why is the Aggregator score drifting down?',
    'List failed crawl jobs',
    'Explain ERCIE 4-component calculation',
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/20 backdrop-blur-xs select-none">
      <div className="w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Drawer Header */}
        <div className="h-11 border-b border-slate-200 px-3 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-1.5 font-bold text-slate-900">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" />
            <span>AI Copilot (Module 24)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 p-3 overflow-y-auto space-y-2.5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${
                m.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[85%] p-2 rounded text-xs leading-relaxed ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                }`}
              >
                {m.text}
              </div>
              {m.actionButton && (
                <button
                  type="button"
                  onClick={() => {
                    navigate(m.actionButton!.path);
                    onClose();
                  }}
                  className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded cursor-pointer self-start"
                >
                  <span>{m.actionButton.label}</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2 border-t border-slate-100 bg-slate-50 space-y-1">
          <span className="text-[9px] text-slate-400 uppercase font-semibold block px-1">
            Suggested Queries
          </span>
          <div className="flex flex-wrap gap-1">
            {sampleQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleSend(q)}
                className="text-[10px] text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-left truncate max-w-[200px] cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-2.5 border-t border-slate-200 flex gap-1.5"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask AI Copilot..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
