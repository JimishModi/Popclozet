// src/components/FAQSection.tsx
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import {
  CustomAccordion,
  CustomAccordionItem,
  CustomAccordionTrigger,
  CustomAccordionContent,
} from "@/components/ui/custom-faq-accordion";
import ContactSupportButton from "@/components/ContactSupportButton"; // new import

const faqs = [
  {
    question: "How does the 60-minute delivery work?",
    answer:
      "Once you place your order, our team picks, quality-checks, and packs your outfit from our local micro-warehouse. We partner with reliable delivery services to ensure your outfit arrives within 60 minutes. You'll get real-time tracking so you know exactly when it's arriving!",
  },
  {
    question: "What about hygiene and cleaning?",
    answer:
      "Every single outfit is professionally dry-cleaned and sanitized after each rental. We use eco-friendly cleaning methods and seal each item in a protective bag. Your outfit will arrive fresh, clean, and ready to wear, it's like getting brand new clothes every time.",
  },
  {
    question: "What if I spill something or damage an item?",
    answer:
      "Life happens! Minor wear and tear is completely covered, that's normal use. For accidental stains or damage, we have a simple damage protection fee (much cheaper than buying the item). Just let us know what happened when you return it, and we'll take care of the rest.",
  },
  {
    question: "How long is a standard rental?",
    answer:
      "Our standard rental is 48 hours, giving you plenty of time to wear and enjoy your outfit. Need it longer? You can easily extend your rental through the app. We'll arrange a convenient pickup time when you're done, no washing required!",
  },
  {
    question: "Is this really more sustainable than buying?",
    answer:
      "Absolutely! By sharing clothes instead of everyone buying their own, we dramatically reduce fashion waste and overproduction. One outfit can be worn by dozens of people instead of sitting in a closet unused. Plus, our eco-friendly cleaning process and local delivery minimize environmental impact.",
  },
  {
    question: "What happens if my outfit doesn't fit?",
    answer:
      "We understand that fit is everything, and we've designed our service to solve this. Our goal is to ensure you look and feel amazing, with zero stress.",
  },
];

const FAQ = () => {
  return (
    <section
      id="faq"
      className="py-20 md:py-28 px-4 bg-[#F6F0E0] dark:bg-[#1A1A1A] relative overflow-hidden"
    >
      {/* Background Elements */}
      <div className="absolute inset-0 bg-[#E3BBE6]/5 dark:bg-[#302038]/10"></div>

      <div className="container mx-auto max-w-3xl relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-12 h-12 bg-[#EB76C2] rounded-full flex items-center justify-center shadow-lg">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 font-playfair text-black dark:text-[#FAFAFA]">
            <span>Got Questions? </span>
            <span className="text-[#EB76C2]">We've Got Answers.</span>
          </h2>
          <p className="text-black/60 dark:text-[#FAFAFA]/60 text-base md:text-lg max-w-2xl mx-auto">
            Everything you need to know about Popclozet
          </p>
        </motion.div>

        {/* FAQ Accordion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <CustomAccordion type="single" collapsible defaultValue="item-0" className="space-y-4">
            {faqs.map((faq, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
              >
                <CustomAccordionItem
                  value={`item-${index}`}
                  className="glass-strong border-primary/20 rounded-2xl px-6 py-2 hover:shadow-card-premium transition-all"
                >
                  <CustomAccordionTrigger className="text-lg font-semibold text-headline hover:text-primary">
                    {faq.question}
                  </CustomAccordionTrigger>
                  <CustomAccordionContent className="text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </CustomAccordionContent>
                </CustomAccordionItem>
              </motion.div>
            ))}
          </CustomAccordion>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-muted-foreground mb-4">Still have questions?</p>

          {/* Replace the static button with the ContactSupportButton component so clicking routes to /signup */}
          <ContactSupportButton />
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
