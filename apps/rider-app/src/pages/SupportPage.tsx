/**
 * Support Page
 * 
 * Help center with FAQ and contact options
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Phone, MessageCircle, Mail, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface FaqItem {
    question: string;
    answer: string;
}

const faqItems: FaqItem[] = [
    {
        question: 'How do I start accepting orders?',
        answer: 'Toggle the online switch on the home screen to start receiving order requests. Make sure your location is enabled and you are in a serviceable area.',
    },
    {
        question: 'How are my earnings calculated?',
        answer: 'Your earnings include base delivery fee, tips from customers, and any applicable bonuses. Base fee depends on distance and order type. You can view detailed breakdown in Earnings page.',
    },
    {
        question: 'When can I withdraw my earnings?',
        answer: 'You can withdraw your earnings anytime, provided you have a minimum balance of ₹100. Withdrawals are processed within 24-48 hours to your linked bank account.',
    },
    {
        question: 'What if I cannot find the customer?',
        answer: 'Use the call or message option on the delivery screen to contact the customer. If unreachable after 5 minutes, contact support through the app.',
    },
    {
        question: 'How do I update my documents?',
        answer: 'Go to Profile > Documents to upload or update your driving license, vehicle RC, and other required documents. Our team will verify them within 24 hours.',
    },
    {
        question: 'What if I have a vehicle breakdown?',
        answer: 'Contact support immediately through the app. We will help reassign your current orders and guide you on next steps.',
    },
];

const contactOptions = [
    {
        icon: Phone,
        label: 'Call Support',
        description: 'Available 24/7',
        action: 'tel:+911234567890',
        color: 'text-green-500 bg-green-500/10',
    },
    {
        icon: MessageCircle,
        label: 'WhatsApp',
        description: 'Quick response',
        action: 'https://wa.me/911234567890',
        color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
        icon: Mail,
        label: 'Email Us',
        description: 'For detailed queries',
        action: 'mailto:support@qikwil.com',
        color: 'text-blue-500 bg-blue-500/10',
    },
];

export function SupportPage() {
    const navigate = useNavigate();
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    return (
        <div className="min-h-screen bg-[#0a0a0a]">
            {/* Header */}
            <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50">
                <div className="flex items-center gap-4 px-4 h-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-semibold text-white">Help & Support</h1>
                </div>
            </header>

            <main className="px-4 py-6 space-y-6">
                {/* Contact Options */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Contact Us</h2>
                    <div className="grid grid-cols-3 gap-3">
                        {contactOptions.map((option) => (
                            <a
                                key={option.label}
                                href={option.action}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex flex-col items-center p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                            >
                                <div className={clsx(
                                    "w-10 h-10 rounded-full flex items-center justify-center mb-2",
                                    option.color
                                )}>
                                    <option.icon size={20} />
                                </div>
                                <span className="text-sm text-white font-medium">{option.label}</span>
                                <span className="text-xs text-zinc-500">{option.description}</span>
                            </a>
                        ))}
                    </div>
                </section>

                {/* Quick Actions */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Quick Actions</h2>
                    <div className="space-y-2">
                        <button
                            onClick={() => navigate('/report-issue')}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                                <HelpCircle className="text-red-500" size={20} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className="text-white font-medium">Report an Issue</p>
                                <p className="text-xs text-zinc-500">Having problems? Let us know</p>
                            </div>
                        </button>
                    </div>
                </section>

                {/* FAQ Section */}
                <section>
                    <h2 className="text-sm font-medium text-zinc-500 mb-3">Frequently Asked Questions</h2>
                    <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
                        {faqItems.map((faq, index) => (
                            <div
                                key={index}
                                className={clsx(
                                    index !== faqItems.length - 1 && "border-b border-zinc-800"
                                )}
                            >
                                <button
                                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                    className="w-full flex items-center justify-between p-4 text-left"
                                >
                                    <span className="text-white font-medium pr-4">{faq.question}</span>
                                    <motion.div
                                        animate={{ rotate: expandedFaq === index ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <ChevronDown size={20} className="text-zinc-500 flex-shrink-0" />
                                    </motion.div>
                                </button>

                                <AnimatePresence>
                                    {expandedFaq === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="px-4 pb-4 text-sm text-zinc-400">
                                                {faq.answer}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

export default SupportPage;
