import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'course_inquiry',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-2xl mb-12">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827]">
          Contact Edufy Academy
        </h1>
        <p className="text-sm text-[#64748B] mt-2">
          Have questions about our curriculum, enterprise team licenses, or instructor partnerships? Our student advisory team is here to assist.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Contact Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-xl border border-[#E2E8F0] shadow-xs">
          {submitted ? (
            <div className="text-center py-12 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="font-display text-lg font-bold text-[#111827]">Message Received</h3>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                Thank you for reaching out. An Edufy academic advisor will review your note and respond within 24 business hours.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 px-4 py-2 text-xs font-semibold text-[#004AAD] bg-[#EBF3FF] rounded-lg"
              >
                Send Another Message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Alex Jordan"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="alex.jordan@company.com"
                  className="w-full px-3.5 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                  Subject Topic
                </label>
                <select
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD]"
                >
                  <option value="course_inquiry">Course Curriculum & Enrollment</option>
                  <option value="enterprise">Enterprise & Team Licensing</option>
                  <option value="instructor_application">Teaching at Edufy</option>
                  <option value="billing">Billing & Refund Assistance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#111827] uppercase tracking-wider mb-1.5">
                  Your Inquiry
                </label>
                <textarea
                  rows={5}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Please describe how we can assist you..."
                  className="w-full px-3.5 py-2.5 text-xs bg-[#F7F9FC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#004AAD]"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 text-xs font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-lg shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Send Message</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Office Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] space-y-4">
            <h3 className="font-display text-base font-bold text-[#111827]">Direct Contact</h3>
            <div className="space-y-3 text-xs text-[#64748B]">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-[#004AAD]" />
                <span>support@edufy.academy</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-[#004AAD]" />
                <span>+1 (800) 542-3389 (Mon-Fri 9am-6pm PT)</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#004AAD]" />
                <span>500 Howard Street, Suite 400, San Francisco, CA 94105</span>
              </div>
            </div>
          </div>

          <div className="bg-[#EBF3FF] p-6 rounded-xl border border-blue-200 text-xs space-y-2">
            <h4 className="font-bold text-[#004AAD]">Enterprise Training Inquiries</h4>
            <p className="text-[#64748B] leading-relaxed">
              Equipping a team of 10+ software engineers? Contact our corporate team solutions desk for pooled licensing and custom learning paths.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
