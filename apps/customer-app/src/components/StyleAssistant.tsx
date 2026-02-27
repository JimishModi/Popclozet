import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Sparkles, User, Bot } from "lucide-react";
import { OPENAI_API_KEY } from "@/config/openai";
import { useLocation } from "react-router-dom";
import { ChatInput, ChatInputTextArea, ChatInputSubmit } from "@/components/ui/chat-input";

interface Message {
    role: "user" | "assistant";
    content: string;
}

const BASE_CONTEXT = `
You are the PopClozet Style Assistant. You help users pick outfits from our rental collection.
We offer premium fashion rentals delivered in 60 minutes.
Our collection includes:
- Elegant Black Dress (Date Night, ₹499)
- Classic Navy Suit (Formal, ₹899)
- Floral Summer Dress (Casual, ₹399)
- Red Carpet Gown (Party, ₹1299)
- Boho Chic Maxi (Vacation, ₹450)
- Designer Tuxedo (Wedding, ₹1500)
- Streetwear Denim Jacket (Casual, ₹299)
- Traditional Silk Saree (Festive, ₹999)

When recommending, be helpful, stylish, and concise. Always suggest specific items from our collection if relevant.
`;

const getContextForRoute = (pathname: string) => {
    if (pathname === "/") {
        return `${BASE_CONTEXT}\nYou are currently on the Home Page. Welcome the user warmly to PopClozet.`;
    } else if (pathname.includes("/shop")) {
        return `${BASE_CONTEXT}\nYou are currently on the Shopping Page. Focus on helping the user choose an outfit from the list.`;
    } else if (pathname.includes("/cart")) {
        return `${BASE_CONTEXT}\nYou are currently on the Cart Page. Help the user review their items or answer questions about checkout/delivery.`;
    } else if (pathname.includes("/profile")) {
        return `${BASE_CONTEXT}\nYou are currently on the Profile Page. Help the user with account details, order history, or settings.`;
    } else if (pathname.includes("/how-it-works") || pathname.includes("/support")) {
        return `${BASE_CONTEXT}\nYou are currently on the Support/How It Works Page. Explain the rental process clearly.`;
    }
    return BASE_CONTEXT;
};

const getWelcomeMessageForRoute = (pathname: string) => {
    if (pathname === "/") {
        return "Hi! Greetings from PopClozet. How can I help you today?";
    } else if (pathname.includes("/shop")) {
        return "Looking for something specific? Ask me what outfit you can choose!";
    } else if (pathname.includes("/cart")) {
        return "Need help with your cart or checkout?";
    } else if (pathname.includes("/profile")) {
        return "Hi! Need help with your account or recent orders?";
    } else if (pathname.includes("/how-it-works")) {
        return "Hi! Have questions about how PopClozet works?";
    }
    return "Hi! I'm your personal stylist. Need help finding the perfect look?";
};

export const StyleAssistant = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Reset chat when route changes
    useEffect(() => {
        setMessages([
            { role: "assistant", content: getWelcomeMessageForRoute(location.pathname) }
        ]);
    }, [location.pathname]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput("");
        setMessages(prev => [...prev, { role: "user", content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: getContextForRoute(location.pathname) },
                        ...messages.map(m => ({ role: m.role, content: m.content })),
                        { role: "user", content: userMessage }
                    ],
                    max_tokens: 150
                })
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            const aiResponse = data.choices[0].message.content;
            setMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
        } catch (error) {
            console.error("Error calling OpenAI:", error);
            setMessages(prev => [...prev, { role: "assistant", content: "Sorry, I'm having trouble connecting to the fashion server right now. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStop = () => {
        setIsLoading(false);
    };

    return (
        <>
            {/* Floating Button - Optimized for Mobile */}
            <motion.button
                className="fixed bottom-28 right-4 md:right-8 md:bottom-8 z-[9999] bg-gradient-to-r from-primary to-purple-600 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-105"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsOpen(true)}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
            >
                <MessageCircle className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
            </motion.button>

            {/* Chat Window - Mobile Optimized */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-28 right-4 left-4 md:left-auto md:right-8 md:bottom-24 z-[9999] w-auto md:w-96 h-[60vh] md:h-[550px] bg-background border border-border rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-4 bg-gradient-to-r from-primary to-purple-600 text-white flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                                    <Sparkles className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">PopClozet Stylist</h3>
                                    <p className="text-xs text-white/90">AI Fashion Assistant</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="hover:bg-white/20 p-2 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-secondary/10 dark:bg-background">
                            {messages.map((msg, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === "user"
                                        ? "bg-secondary text-secondary-foreground"
                                        : "bg-gradient-to-r from-primary to-purple-600 text-white"
                                        }`}>
                                        {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                    </div>
                                    <div className={`p-3 rounded-2xl max-w-[85%] text-sm leading-relaxed shadow-sm ${msg.role === "user"
                                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                                        : "bg-card border border-border text-card-foreground rounded-tl-sm"
                                        }`}>
                                        {msg.content}
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex gap-3"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-primary to-purple-600 text-white flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4" />
                                    </div>
                                    <div className="bg-card border border-border p-4 rounded-2xl rounded-tl-sm shadow-sm">
                                        <div className="flex gap-1.5">
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.15s" }} />
                                            <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input - Using new ChatInput component */}
                        <div className="p-3 bg-background border-t border-border">
                            <ChatInput
                                variant="default"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onSubmit={handleSend}
                                loading={isLoading}
                                onStop={handleStop}
                                rows={1}
                            >
                                <ChatInputTextArea
                                    placeholder="Ask for outfit advice..."
                                    className="text-sm min-h-[44px] bg-secondary/20 dark:bg-secondary/40 border-0 focus-visible:ring-1"
                                />
                                <ChatInputSubmit className="bg-gradient-to-r from-primary to-purple-600 hover:opacity-90 text-white border-none h-10 w-10 p-0 flex items-center justify-center" />
                            </ChatInput>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
