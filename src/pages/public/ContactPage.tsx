import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2, Clock, MessageCircle } from 'lucide-react';
import { useSiteSettings } from '../../context/SettingsContext';
import { isHttps, telHref, waHref } from '../../config/siteSettings';

export const ContactPage: React.FC = () => {
  const { settings } = useSiteSettings();
  const c = settings.contact;
  const wa = settings.whatsapp;
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
    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 py-12">
      <div className="max-w-2xl mb-12">
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-[#111827]">
          {c.pageTitle || 'Contact Edufy Academy'}
        </h1>
        {c.pageIntro && <p className="text-sm text-[#64748B] mt-2">{c.pageIntro}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Contact Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-8 rounded-2xl border border-[#E2E8F0] shadow-xs">
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
                className="w-full py-3 px-4 text-sm font-bold text-white bg-[#004AAD] hover:bg-[#003B8B] rounded-full shadow transition-colors flex items-center justify-center gap-2"
              >
                <span>Send Message</span>
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>

        {/* Office Details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-[#E2E8F0] space-y-4">
            <h3 className="font-display text-base font-bold text-[#111827]">Direct Contact</h3>
            <div className="space-y-3 text-xs text-[#64748B]">
              {c.supportEmail && (
                <a href={`mailto:${c.supportEmail}`} className="flex items-center gap-3 hover:text-[#004AAD]">
                  <Mail className="w-4 h-4 text-[#004AAD]" />
                  <span>{c.supportEmail} <span className="text-[#94A3B8]">(support)</span></span>
                </a>
              )}
              {c.salesEmail && (
                <a href={`mailto:${c.salesEmail}`} className="flex items-center gap-3 hover:text-[#004AAD]">
                  <Mail className="w-4 h-4 text-[#004AAD]" />
                  <span>{c.salesEmail} <span className="text-[#94A3B8]">(sales)</span></span>
                </a>
              )}
              {[c.primaryPhone, c.secondaryPhone].filter(Boolean).map((p) => (
                <a key={p} href={telHref(p)} className="flex items-center gap-3 hover:text-[#004AAD]">
                  <Phone className="w-4 h-4 text-[#004AAD]" />
                  <span>{p}</span>
                </a>
              ))}
              {wa.enabled && waHref(wa.number) && (
                <a href={waHref(wa.number, wa.welcomeMessage)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-[#004AAD]">
                  <MessageCircle className="w-4 h-4 text-[#004AAD]" />
                  <span>WhatsApp {wa.number}</span>
                </a>
              )}
              {c.businessHours && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-[#004AAD]" />
                  <span>{c.businessHours}</span>
                </div>
              )}
              {c.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#004AAD] mt-0.5" />
                  <span className="whitespace-pre-line">
                    {c.address}
                    {isHttps(c.mapsUrl) && (
                      <>
                        {' '}
                        <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-[#004AAD] font-semibold">View on map</a>
                      </>
                    )}
                  </span>
                </div>
              )}
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
