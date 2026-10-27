import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

export const FaqPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'How does lifetime course access work?',
      a: 'Once enrolled in any Edufy Academy masterclass, you receive indefinite access to all present lectures, coding exercises, downloadable assets, and any future curriculum updates published by the instructor.',
    },
    {
      q: 'Are Edufy certificates recognized by employers?',
      a: 'Yes. Each certificate includes a unique verification identifier and cryptographic hash. Employers and recruiters can verify your credentials directly on our public verification portal at /verify-certificate.',
    },
    {
      q: 'What is your refund policy?',
      a: 'We offer a no-questions-asked 30-day money-back guarantee on all single course purchases, provided less than 50% of the course video content has been consumed.',
    },
    {
      q: 'Can I download videos for offline learning?',
      a: 'Downloadable resources (such as starter code, PDF blueprints, cheatsheets, and architectural diagrams) are available for offline study. Video streaming is optimized with adaptive bitrates on all devices.',
    },
    {
      q: 'How do quizzes and assessments work?',
      a: 'Each module includes practical multiple-choice knowledge checks and code analysis problems. You need 75% or higher to pass, and you can re-attempt quizzes as many times as needed.',
    },
  ];

  const filteredFaqs = faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(search.toLowerCase()) ||
      f.a.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      <div className="text-center max-w-xl mx-auto space-y-3">
        <h1 className="font-display text-3xl font-extrabold text-[#111827]">
          Frequently Asked Questions
        </h1>
        <p className="text-sm text-[#64748B]">
          Answers to common questions regarding course enrollments, certificates, and platform policies.
        </p>

        <div className="relative pt-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full pl-9 pr-3 py-2.5 text-xs bg-white border border-[#E2E8F0] rounded-xl shadow-xs focus:outline-none focus:border-[#004AAD]"
          />
          <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-7" />
        </div>
      </div>

      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden transition-colors"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-5 text-left flex items-center justify-between text-sm font-bold text-[#111827] hover:text-[#004AAD]"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[#64748B] transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-5 pb-5 text-xs text-[#64748B] leading-relaxed border-t border-[#E2E8F0] pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
