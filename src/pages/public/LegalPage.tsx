import React from 'react';
import { useLocation } from 'react-router-dom';

export const LegalPage: React.FC = () => {
  const location = useLocation();
  const path = location.pathname;

  let title = 'Privacy Policy';
  let lastUpdated = 'October 2026';
  let content = (
    <>
      <p>
        At Edufy Academy, accessible from edufy.academy, one of our main priorities is the privacy of our visitors and students. This Privacy Policy document contains types of information that is collected and recorded by Edufy Academy and how we use it.
      </p>
      <h3>Information We Collect</h3>
      <p>
        When you register for an account, purchase a course, or contact support, we collect your name, email address, payment transaction metadata, course progress, and quiz evaluation scores. We do not store full credit card numbers on our servers.
      </p>
      <h3>How We Use Your Data</h3>
      <p>
        We use collected data to deliver course video streams, generate cryptographically verified certificates of completion, track curriculum progress, and provide customer support.
      </p>
      <h3>Data Security</h3>
      <p>
        All communications with Edufy Academy are secured using TLS encryption. We maintain strict role-based access control policies across our employee and engineering squads.
      </p>
    </>
  );

  if (path === '/terms') {
    title = 'Terms of Service';
    content = (
      <>
        <p>
          Welcome to Edufy Academy. By accessing or using our website, courses, video player, and certifications, you agree to be bound by these Terms of Service.
        </p>
        <h3>License & Intellectual Property</h3>
        <p>
          Upon purchasing a course, Edufy grants you a personal, non-exclusive, non-transferable license to access and view the course lectures and download accompanying source code files for your individual educational use. You may not re-distribute, resell, or publicly broadcast course videos.
        </p>
        <h3>Student Conduct</h3>
        <p>
          You agree to participate respectfully in course discussion forums, Q&A boards, and community spaces. Harassment, unauthorized promotional spam, or academic dishonesty on quizzes will result in immediate termination of account access.
        </p>
      </>
    );
  } else if (path === '/refund') {
    title = '30-Day Refund Policy';
    content = (
      <>
        <p>
          We want you to be completely satisfied with your learning experience at Edufy Academy. If a course does not meet your expectations, you may request a full refund within 30 days of purchase.
        </p>
        <h3>Eligibility Conditions</h3>
        <p>
          To prevent abuse, refund requests are honored provided you have watched less than 50% of the total course video lectures and have not yet been conferred an official verified certificate of completion for that course.
        </p>
        <h3>How to Request a Refund</h3>
        <p>
          Simply visit your student account settings, navigate to Purchase History, or email support@edufy.academy with your transaction receipt ID. Refunds are credited back to your original payment method within 3 to 5 business days.
        </p>
      </>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <div className="text-xs font-bold text-[#004AAD] uppercase tracking-wider">
          Legal & Compliance
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827] mt-1">
          {title}
        </h1>
        <div className="text-xs text-[#64748B] mt-1">Last Updated: {lastUpdated}</div>
      </div>

      <div className="bg-white p-6 sm:p-10 rounded-xl border border-[#E2E8F0] prose prose-slate max-w-none text-xs sm:text-sm text-[#111827] leading-relaxed space-y-4">
        {content}
      </div>
    </div>
  );
};
